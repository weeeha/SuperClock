# Night Mode Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Scheduled night mode — the white surfaces (Minimalismo, Complications Light, Quote) flip to black during a per-device night window, with optional panel dimming.

**Architecture:** Finish the existing-but-dead theme system. A new `settings.night: { start, end, brightness? }` drives the already-toggled-but-unconsumed `html.dark` class on a 30 s client evaluator; the three white surfaces are retrofitted to CSS tokens (`--face-bg`, `--face-ink`, …) that flip under `html.dark` with a 1 s cross-fade; the server display-adapter picks `night.brightness` inside the same window via a shared `isWithinWindow` helper extracted from its sleep-schedule code. `theme: 'system'` becomes "Auto" (light by day, dark in the window); a one-time fleet migration normalizes stored `'dark'` → `'system'` on kiosks.

**Tech Stack:** React 19 + TypeScript (strict, `verbatimModuleSyntax`), Tailwind v4 (`bg-(--var)` arbitrary-value syntax), Zustand, Express + tsx, wlr-randr (Pi only).

**Spec:** `docs/superpowers/specs/2026-06-12-night-mode-design.md`

**Prerequisites:** Run `npm ci` once in the worktree (worktrees start without `node_modules`). End every commit message with the `Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>` trailer. No test runner exists in this repo — verification is `npm run build`, `npm run lint`, `node --import tsx -e` spot-checks, and Claude Preview. The preview tab is backgrounded: timers/animations are suppressed, so never verify by "waiting" — drive navigation via `window.__nav` and call `finishTransition()` after transitions; mount-time effects DO run.

**Verified-from-source facts** (so you don't re-derive them):
- PATCH/POST config routes spread the body over the current config with no per-field validation — `settings.night` flows end-to-end with **zero route changes**.
- `useApplySettings()` is already mounted in `src/App.tsx:30`.
- The ESLint `setInterval` ban is scoped to `src/apps/clock/**` only — `src/core/` may use it.
- `var()` does **not** work in SVG *presentation attributes* (`fill="var(--x)"` is invalid) — themed SVG colors must be classes (`fill-(--face-bg)`) or inline `style`.
- `config/fleet.json` is gitignored per-Pi state; `config/fleet.example.json` is checked in.
- Open PR #12 also edits `src/apps/quote/QuoteApp.tsx` (portraits). Task 7's class replacements exist verbatim in both versions; if PR #12 merges first, re-apply the same three class swaps.

---

### Task 1: Shared time-window helper + data model

**Files:**
- Create: `src/shared/time-window.ts`
- Modify: `src/shared/types.ts` (FeatureFlag, settings, FleetConfig)
- Modify: `src/shared/capabilities.ts` (kiosk feature arrays)

- [ ] **Step 1: Create `src/shared/time-window.ts`**

```ts
// Shared HH:MM time-window evaluation for schedule features (sleep, night).
// Used by BOTH the kiosk client (theme class) and the Express server
// (display-adapter brightness/power) — keep it dependency-free.

export interface TimeWindow {
  start: string; // 24h "HH:MM" — window opens
  end: string; // 24h "HH:MM" — window closes (may be past midnight)
}

function toMinutes(hhmm: string): number | null {
  const m = /^(\d{1,2}):(\d{2})$/.exec(hhmm.trim());
  if (!m) return null;
  const h = Number(m[1]);
  const min = Number(m[2]);
  if (h > 23 || min > 59) return null;
  return h * 60 + min;
}

// True when `now` falls inside [start, end), handling windows that wrap past
// midnight (e.g. 21:00 → 07:00). Missing window, malformed times, or
// start === end → false (window never active) — mirrors the sleep-schedule
// behavior this was extracted from (server/display-adapter.ts).
export function isWithinWindow(window: TimeWindow | undefined, now: Date): boolean {
  if (!window) return false;
  const start = toMinutes(window.start);
  const end = toMinutes(window.end);
  if (start === null || end === null || start === end) return false;
  const cur = now.getHours() * 60 + now.getMinutes();
  return start < end ? cur >= start && cur < end : cur >= start || cur < end;
}
```

- [ ] **Step 2: Extend `src/shared/types.ts`**

Add `'night_mode'` to the `FeatureFlag` union:

```ts
export type FeatureFlag =
  | 'brightness'
  | 'sleep_schedule'
  | 'theme'
  | 'accent'
  | 'night_mode';
```

Add `night` to `DeviceConfig['settings']` (after `sleepSchedule`):

```ts
  settings: {
    theme: 'light' | 'dark' | 'system';
    accent: string;
    brightness?: number;
    sleepSchedule?: { wake: string; sleep: string };
    night?: { start: string; end: string; brightness?: number };
  };
```

Add `schemaVersion` to `FleetConfig`:

```ts
export interface FleetConfig {
  devices: DeviceConfig[];
  version: number;
  schemaVersion?: number;
}
```

- [ ] **Step 3: Add the flag to the three kiosk devices in `src/shared/capabilities.ts`**

In `STATIC_DEVICE_INFO`, change the `features` array of `superclock-fast`, `superclock-small`, and `superclock-square` (NOT `superclock-slow`) to:

```ts
    features: ['brightness', 'sleep_schedule', 'theme', 'accent', 'night_mode'],
```

- [ ] **Step 4: Verify build + spot-check the helper**

Run: `npm run build`
Expected: `✓ built in …` with no TS errors.

Run (from the repo root; `node -e` is CJS, so use `require` — the tsx hook transpiles the TS module):

```bash
node --import tsx -e "
const { isWithinWindow } = require('./src/shared/time-window.ts');
const at = (h, m) => new Date(2026, 5, 12, h, m);
console.log([
  isWithinWindow({ start: '21:00', end: '07:00' }, at(23, 0)),
  isWithinWindow({ start: '21:00', end: '07:00' }, at(3, 0)),
  isWithinWindow({ start: '21:00', end: '07:00' }, at(12, 0)),
  isWithinWindow({ start: '21:00', end: '07:00' }, at(7, 0)),
  isWithinWindow({ start: '21:00', end: '07:00' }, at(21, 0)),
  isWithinWindow({ start: '09:00', end: '17:00' }, at(12, 0)),
  isWithinWindow({ start: 'xx', end: '07:00' }, at(23, 0)),
  isWithinWindow({ start: '07:00', end: '07:00' }, at(7, 0)),
  isWithinWindow(undefined, at(23, 0)),
].join(' '));
"
```

Expected output: `true true false false true true false false false`
(wrap-evening, wrap-after-midnight, daytime, end-exclusive, start-inclusive, same-day, malformed, start===end, unset)

- [ ] **Step 5: Commit**

```bash
git add src/shared/time-window.ts src/shared/types.ts src/shared/capabilities.ts
git commit -m "feat(night): shared time-window helper + night settings data model"
```

---

### Task 2: Display-adapter — night brightness, refactor onto shared helper

**Files:**
- Modify: `server/display-adapter.ts` (delete `isWithinSleepWindow` ~lines 181–203, rewire `reconcile` ~lines 223–224)

- [ ] **Step 1: Import the shared helper**

At the top of `server/display-adapter.ts`, extend the existing shared-types import area:

```ts
import type { DeviceConfig } from '../src/shared/types';
import { isWithinWindow } from '../src/shared/time-window';
```

- [ ] **Step 2: Delete the local `isWithinSleepWindow` function entirely** (the block from the comment `// Returns true when \`now\` falls inside the [sleep, wake) window…` through its closing brace — its logic now lives in `src/shared/time-window.ts`).

- [ ] **Step 3: Rewire `reconcile`**

Replace these two lines:

```ts
    const wantBrightness = clampBrightness(config.settings.brightness);
    const wantPoweredOn = !isWithinSleepWindow(config.settings.sleepSchedule, new Date());
```

with:

```ts
    const { brightness, night, sleepSchedule } = config.settings;
    const now = new Date();
    // Night brightness wins inside the night window; day brightness otherwise.
    const nightActive = isWithinWindow(night, now);
    const wantBrightness = clampBrightness(
      nightActive && night?.brightness != null ? night.brightness : brightness,
    );
    const wantPoweredOn = !isWithinWindow(
      sleepSchedule && { start: sleepSchedule.sleep, end: sleepSchedule.wake },
      now,
    );
```

(Sleep maps `{ sleep → start, wake → end }`: the panel is off between `sleep` and `wake`. The existing 30 s `scheduleTimer` already re-runs `reconcile`, so night dimming engages/disengages on time with no new machinery. The post-wake `applied.brightness = null` reset already re-asserts the night value after a mid-window wake.)

- [ ] **Step 4: Verify**

Run: `npm run build && npm run lint`
Expected: build succeeds; lint exits silently (no output = clean).

- [ ] **Step 5: Commit**

```bash
git add server/display-adapter.ts
git commit -m "feat(night): display-adapter applies night brightness inside the window"
```

---

### Task 3: Default theme 'system' + one-time fleet migration

**Files:**
- Modify: `src/shared/types.ts` (`emptyDeviceConfig`)
- Modify: `server/fleet-store.ts` (schema version, `migrateFleet`)
- Modify: `server.ts` (call site, ~line 62)
- Modify: `config/fleet.example.json`

- [ ] **Step 1: Change the default theme in `emptyDeviceConfig` (`src/shared/types.ts`)**

```ts
    settings: { theme: 'system', accent: '#ff6b35' },
```

- [ ] **Step 2: Add schema version + migration to `server/fleet-store.ts`**

Add to the imports:

```ts
import { STATIC_DEVICE_INFO } from '../src/shared/capabilities';
```

Add below the `FLEET_EXAMPLE_PATH` constant:

```ts
const FLEET_SCHEMA_VERSION = 1;
```

Change `defaultFleet` to stamp the version:

```ts
function defaultFleet(): FleetConfig {
  return {
    devices: ALL_DEVICE_IDS.map(emptyDeviceConfig),
    version: 0,
    schemaVersion: FLEET_SCHEMA_VERSION,
  };
}
```

Add at the bottom of the file:

```ts
// One-time, idempotent schema migration, called at server startup.
// v1: `theme` was a visual no-op before night mode shipped, so stored 'dark'
// values carry no user intent — normalize kiosk devices to 'system' (Auto) so
// daytime keeps today's light faces and the night window takes effect.
export async function migrateFleet(): Promise<void> {
  const fleet = await readFleet();
  if ((fleet.schemaVersion ?? 0) >= FLEET_SCHEMA_VERSION) return;
  const devices = fleet.devices.map((d) => {
    if (STATIC_DEVICE_INFO[d.deviceId]?.kind !== 'kiosk') return d;
    if (d.settings.theme !== 'dark') return d;
    return { ...d, settings: { ...d.settings, theme: 'system' as const } };
  });
  await writeFleet({ ...fleet, devices, schemaVersion: FLEET_SCHEMA_VERSION });
}
```

- [ ] **Step 3: Call it from `server.ts`**

Add `migrateFleet` to the existing `./server/fleet-store` import (the one that provides `readDevice`). Then, directly ABOVE the `void initDisplayAdapter(…)` line (~line 62), add:

```ts
  // One-time fleet schema migration (theme 'dark' → 'system' for kiosks).
  void migrateFleet().catch((err) =>
    console.warn('[fleet] migration failed (ignored):', (err as Error).message),
  );
```

(Ordering vs `initDisplayAdapter` doesn't matter — the adapter never reads `theme`.)

- [ ] **Step 4: Update `config/fleet.example.json`**

Change all four `"theme": "dark"` to `"theme": "system"`, and add the schema version after `"version": 0`:

```json
  "version": 0,
  "schemaVersion": 1
```

- [ ] **Step 5: Verify build + migration spot-check in a temp dir**

Run: `npm run build && npm run lint` → clean.

Run (uses an unmigrated fixture; `fleet-store` resolves paths from `process.cwd()` at module load, so run from the temp dir and `require` the store by absolute path — `require`, not `import()`, because the repo path contains a space, which breaks ESM URL resolution but not `require`):

```bash
REPO=$PWD; TMP=$(mktemp -d); mkdir -p "$TMP/config"
cat > "$TMP/config/fleet.json" <<'EOF'
{"devices":[
 {"deviceId":"superclock-fast","enabledApps":[],"instances":[],"playlist":{"items":[],"rotationSeconds":null},"settings":{"theme":"dark","accent":"#ff6b35"},"updatedAt":"1970-01-01T00:00:00.000Z"},
 {"deviceId":"superclock-slow","enabledApps":[],"instances":[],"playlist":{"items":[],"rotationSeconds":null},"settings":{"theme":"dark","accent":"#ff6b35"},"updatedAt":"1970-01-01T00:00:00.000Z"}
],"version":0}
EOF
(cd "$TMP" && node --import tsx -e "const { migrateFleet } = require('$REPO/server/fleet-store.ts'); migrateFleet().then(() => migrateFleet());")
grep -E '"theme"|"schemaVersion"|"version"' "$TMP/config/fleet.json"
```

Expected: `superclock-fast` shows `"theme": "system"`, `superclock-slow` keeps `"theme": "dark"`, `"schemaVersion": 1` present, `"version": 1` (single bump — the second `migrateFleet()` call proves idempotence).

- [ ] **Step 6: Commit**

```bash
git add src/shared/types.ts server/fleet-store.ts server.ts config/fleet.example.json
git commit -m "feat(night): default theme 'system' + one-time fleet migration"
```

---

### Task 4: Theme tokens + client night evaluator

**Files:**
- Modify: `src/index.css`
- Modify: `src/core/apply-settings.ts` (full rewrite below)

- [ ] **Step 1: Add tokens + fade to `src/index.css`** (after the `@theme` block, before `html, body, #root`)

```css
/* Night-mode face tokens. Light is the default (matches the pre-night-mode
   look); html.dark flips them. Only surfaces that opt in consume these. */
:root,
html.light {
  --face-bg: #ffffff;
  --face-ink: #000000;
  --face-ink-muted: #52525b;
  --face-tick: #444444;
}
html.dark {
  --face-bg: #000000;
  --face-ink: #ffffff;
  --face-ink-muted: #a1a1aa;
  --face-tick: #8a8a8a;
}

/* Soft cross-fade for the theme flip. Applied per themed element. */
.theme-fade {
  transition:
    background-color 1s ease,
    fill 1s ease,
    stroke 1s ease,
    color 1s ease;
}
```

- [ ] **Step 2: Replace `src/core/apply-settings.ts` with:**

```ts
import { useEffect, useState } from 'react';
import { useDeviceConfig } from './device-config';
import { isWithinWindow } from '../shared/time-window';

// Re-evaluate the night window this often. Boundary lag budget: ≤5s config
// poll + ≤30s tick — same cadence as the server's display-adapter evaluator.
const NIGHT_TICK_MS = 30_000;

// Reflects DeviceConfig.settings on the live kiosk DOM.
//   accent → overrides --color-accent on <html>
//   theme  → 'light'/'dark' force the html class; 'system' ("Auto" in the
//            admin) follows the night window: dark inside settings.night,
//            light outside. No config / no window → light (today's look).
// Brightness, sleep, and night dimming are server-side (display-adapter).
export function useApplySettings(): void {
  const config = useDeviceConfig();
  const accent = config?.settings.accent;
  const theme = config?.settings.theme;
  const nightStart = config?.settings.night?.start;
  const nightEnd = config?.settings.night?.end;

  const [isNight, setIsNight] = useState(false);

  useEffect(() => {
    const root = document.documentElement;
    if (accent) {
      root.style.setProperty('--color-accent', accent);
    } else {
      root.style.removeProperty('--color-accent');
    }
    return () => {
      root.style.removeProperty('--color-accent');
    };
  }, [accent]);

  useEffect(() => {
    if (!nightStart || !nightEnd) {
      setIsNight(false);
      return;
    }
    const nightWindow = { start: nightStart, end: nightEnd };
    const evaluate = () => setIsNight(isWithinWindow(nightWindow, new Date()));
    evaluate();
    const timer = window.setInterval(evaluate, NIGHT_TICK_MS);
    return () => window.clearInterval(timer);
  }, [nightStart, nightEnd]);

  useEffect(() => {
    const root = document.documentElement;
    const dark = theme === 'dark' || (theme !== 'light' && isNight);
    root.classList.toggle('dark', dark);
    root.classList.toggle('light', !dark);
  }, [theme, isNight]);
}
```

Behavior change note: the old code defaulted `system`/unset to the `dark` class. The class had zero CSS effect until now, so flipping the default to `light` is a visual no-change — and after Task 3 kiosks are on `'system'` anyway.

- [ ] **Step 3: Verify**

Run: `npm run build && npm run lint`
Expected: clean (the react-hooks Compiler ruleset is satisfied: every effect lists exhaustive primitive deps).

- [ ] **Step 4: Commit**

```bash
git add src/index.css src/core/apply-settings.ts
git commit -m "feat(night): face tokens + scheduled dark-class evaluator"
```

---

### Task 5: Minimalismo retrofit

**Files:**
- Modify: `src/apps/clock/MinimalismoClock.tsx`

- [ ] **Step 1: Replace the component's return with the tokenized version**

```tsx
  return (
    <div className="theme-fade flex h-full w-full items-center justify-center bg-(--face-bg)">
      <svg viewBox="0 0 1000 1000" className="h-full w-full max-h-screen max-w-screen">
        <circle cx="500" cy="500" r="500" className="theme-fade fill-(--face-bg)" />
        {/* Hour */}
        <line {...handPoints(hourDeg, 280)} className="theme-fade stroke-(--face-ink)" strokeWidth="28" strokeLinecap="round" />
        {/* Minute */}
        <line {...handPoints(minuteDeg, 380)} className="theme-fade stroke-(--face-ink)" strokeWidth="20" strokeLinecap="round" />
        {/* Second — gold in both themes, sweeps */}
        <line {...handPoints(secondDeg, 350, 80)} stroke="#FFD700" strokeWidth="6" strokeLinecap="round" />
      </svg>
    </div>
  );
```

Also update the doc comment's first line to: `Minimalismo — pure-white face (black at night via --face-bg/--face-ink tokens), gold smoothly-sweeping second hand.` Keep everything else (imports, `useClockHands` call) unchanged.

- [ ] **Step 2: Verify in preview**

1. `preview_start` (vite dev server).
2. First clear any stale dev config so the swipe-cycle (not a config-pinned face) is active: `preview_eval` → `localStorage.removeItem('superclock:device-config'); location.reload(); 'cleared'`.
3. `preview_screenshot` → white face, black hands, gold second hand (Minimalismo is the first face).
4. `preview_eval`: `document.documentElement.classList.remove('light'); document.documentElement.classList.add('dark'); 'ok'`
5. `preview_screenshot` → black face, white hands, gold second hand.
6. `preview_eval`: `document.documentElement.classList.remove('dark'); document.documentElement.classList.add('light'); 'ok'` → back to white.

- [ ] **Step 3: Run `npm run build && npm run lint`** → clean.

- [ ] **Step 4: Commit**

```bash
git add src/apps/clock/MinimalismoClock.tsx
git commit -m "feat(night): Minimalismo consumes face tokens (white by day, black at night)"
```

---

### Task 6: Complications Light retrofit

**Files:**
- Modify: `src/apps/clock/ComplicationsLight.tsx` (3 surgical changes; everything else stays literal)

- [ ] **Step 1: Tick marks** — in the `ticks` loop, replace `stroke="#444"` with a class:

```tsx
      <line
        key={i}
        x1="500" y1={isHour ? 22 : 38} x2="500" y2={isHour ? 72 : 62}
        className="theme-fade stroke-(--face-tick)" strokeWidth={isHour ? 9 : 4} strokeLinecap="round"
        transform={`rotate(${angle} 500 500)`}
      />,
```

- [ ] **Step 2: Face circle** — replace `<circle cx="500" cy="500" r="500" fill="white" />` with:

```tsx
        <circle cx="500" cy="500" r="500" className="theme-fade fill-(--face-bg)" />
```

- [ ] **Step 3: Brand mark** — replace both `stroke="#666"` circles with:

```tsx
        <circle cx="489" cy="88" r="9" fill="none" className="theme-fade stroke-(--face-tick)" strokeWidth="4" />
        <circle cx="511" cy="88" r="9" fill="none" className="theme-fade stroke-(--face-tick)" strokeWidth="4" />
```

Deliberately UNCHANGED (reads well on both grounds): `#1a1a1a` complication discs, white-bordered `#111` hands, accents (`#22c55e`, `#fbbf24`, `#f59e0b`), in-disc text colors, drop-shadow filter.

- [ ] **Step 4: Verify in preview**

In the running preview: `preview_eval` `window.__nav.getState().verticalSwipeCallback('down')` five times (cycle order: minimalismo→analog→productivity→square→floral→complications-light) — then screenshot in light, add `dark` class as in Task 5, screenshot: black face, brighter ticks/brand, discs and accents intact. Remove `dark` afterwards.

- [ ] **Step 5: Run `npm run build && npm run lint`** → clean.

- [ ] **Step 6: Commit**

```bash
git add src/apps/clock/ComplicationsLight.tsx
git commit -m "feat(night): Complications Light face/ticks/brand consume face tokens"
```

---

### Task 7: Quote app retrofit

**Files:**
- Modify: `src/apps/quote/QuoteApp.tsx` (three class swaps)

⚠️ Open PR #12 also edits this file; these exact class strings exist in both versions — if it merged meanwhile, apply the same three swaps to the new JSX.

- [ ] **Step 1: Container** — `bg-white text-black` → tokens:

```tsx
    <div className="theme-fade flex h-full w-full flex-col items-center justify-center bg-(--face-bg) p-[12%] gap-[4%]">
```

- [ ] **Step 2: Author line** — `text-gray-600` → muted ink:

```tsx
      <p className="theme-fade text-[3.5vmin] text-(--face-ink-muted)">{quote.author}</p>
```

- [ ] **Step 3: Quote text** — `text-gray-900` → ink:

```tsx
      <p className="theme-fade text-[5vmin] font-semibold text-center leading-snug text-(--face-ink)">
```

The avatar placeholder (`bg-gray-300`, or PR #12's portrait/initials) stays unchanged.

- [ ] **Step 4: Verify in preview**

`preview_eval`, repeated until the Quote app is active: `window.__nav.getState().swipeToNext()` then `window.__nav.getState().finishTransition()` (backgrounded tab: exit animations never complete on their own — `finishTransition()` is mandatory after every swipe). Check `window.__nav.getState().activeAppId === 'quote'`. Screenshot light → add `dark` class → screenshot: black background, light text, readable author line. Remove `dark`.

- [ ] **Step 5: Run `npm run build && npm run lint`** → clean.

- [ ] **Step 6: Commit**

```bash
git add src/apps/quote/QuoteApp.tsx
git commit -m "feat(night): Quote app consumes face tokens"
```

---

### Task 8: Admin Settings UI — Auto label + Night mode card

**Files:**
- Modify: `src/admin/routes/Settings.tsx`

- [ ] **Step 1: Extend `DEFAULTS`** (top of file):

```ts
const DEFAULTS: SettingsShape = {
  theme: 'dark',
  accent: '#ff6b35',
  brightness: 80,
  sleepSchedule: undefined,
  night: undefined,
};
```

- [ ] **Step 2: Render `'system'` as “auto”** — in the theme button row, replace the button text `{t}` with:

```tsx
                  {t === 'system' ? 'auto' : t}
```

(The `capitalize` class already on the button renders it as “Auto”. Wire value stays `'system'`.)

- [ ] **Step 3: Add a `nightEnabled` flag** next to `sleepEnabled`:

```ts
  const nightEnabled = Boolean(working.night);
```

- [ ] **Step 4: Add the Night mode block** inside the Display `CardContent`, directly after the sleep-schedule `</div>`:

```tsx
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-sm font-medium">Night mode</label>
              <Switch
                checked={nightEnabled}
                disabled={!has('night_mode')}
                onCheckedChange={(on) =>
                  setWorking({
                    ...working,
                    night: on ? { start: '21:00', end: '07:00', brightness: 30 } : undefined,
                  })
                }
              />
            </div>
            {nightEnabled && (
              <>
                <div className="flex items-center gap-3 text-sm">
                  <label className="flex items-center gap-2">
                    Start
                    <input
                      type="time"
                      value={working.night?.start ?? '21:00'}
                      onChange={(e) =>
                        setWorking({
                          ...working,
                          night: {
                            start: e.target.value,
                            end: working.night?.end ?? '07:00',
                            brightness: working.night?.brightness,
                          },
                        })
                      }
                      className="rounded-md border border-[hsl(var(--border))] bg-[hsl(var(--background))] px-2 py-1"
                    />
                  </label>
                  <label className="flex items-center gap-2">
                    End
                    <input
                      type="time"
                      value={working.night?.end ?? '07:00'}
                      onChange={(e) =>
                        setWorking({
                          ...working,
                          night: {
                            start: working.night?.start ?? '21:00',
                            end: e.target.value,
                            brightness: working.night?.brightness,
                          },
                        })
                      }
                      className="rounded-md border border-[hsl(var(--border))] bg-[hsl(var(--background))] px-2 py-1"
                    />
                  </label>
                </div>
                <div className="flex items-center justify-between">
                  <label className="text-sm">Night brightness</label>
                  <span className="text-xs opacity-60">{working.night?.brightness ?? 30}%</span>
                </div>
                <input
                  type="range"
                  min={0}
                  max={100}
                  step={5}
                  value={working.night?.brightness ?? 30}
                  onChange={(e) =>
                    setWorking({
                      ...working,
                      night: {
                        start: working.night?.start ?? '21:00',
                        end: working.night?.end ?? '07:00',
                        brightness: Number(e.target.value),
                      },
                    })
                  }
                  className="w-full"
                />
              </>
            )}
          </div>
```

(UI semantics: the dirty-check, save mutation, and PATCH route need no changes — `night` rides `settings` wholesale. Set night brightness equal to day brightness for recolor-only behavior.)

- [ ] **Step 5: Run `npm run build && npm run lint`** → clean. (Real UI exercise happens in Task 10 against `npm run start`; the admin SPA needs the Express API.)

- [ ] **Step 6: Commit**

```bash
git add src/admin/routes/Settings.tsx
git commit -m "feat(night): admin night-mode card + Auto theme label"
```

---

### Task 9: deploy.sh ships `src/shared`

**Files:**
- Modify: `scripts/deploy.sh`

The server imports **values** from `../src/shared/` (capabilities, and now `time-window` + the migration's `STATIC_DEVICE_INFO`), but the rsync payload omits `src/` — a fresh deploy would crash `tsx server.ts`. (Known gap; this feature makes it load-bearing.)

- [ ] **Step 1: Extend the remote mkdir** (line 21) to include the shared dir:

```bash
ssh "$PI_HOST" "mkdir -p $REMOTE_DIR/scripts $REMOTE_DIR/dist $REMOTE_DIR/server $REMOTE_DIR/src/shared"
```

- [ ] **Step 2: Add the rsync** directly after the `server/` rsync block:

```bash
# Shared modules the server imports at runtime (tsx resolves ../src/shared/*).
rsync -avz --delete src/shared/ "$PI_HOST:$REMOTE_DIR/src/shared/"
```

- [ ] **Step 3: Verify syntax**

Run: `bash -n scripts/deploy.sh`
Expected: no output (parses clean).

- [ ] **Step 4: Commit**

```bash
git add scripts/deploy.sh
git commit -m "fix(deploy): ship src/shared — server imports runtime values from it"
```

---

### Task 10: End-to-end verification

**Files:** none (verification only)

- [ ] **Step 1: Full build + lint**

Run: `npm run build && npm run lint` → clean.

- [ ] **Step 2: Server round-trip of night settings**

```bash
PORT=3344 node --import tsx server.ts & SERVER_PID=$!   # serves dist/ + API; display-adapter no-ops off-Pi
sleep 2
curl -s -X POST localhost:3344/api/device/config \
  -H 'content-type: application/json' \
  -d '{"settings":{"theme":"system","accent":"#ff6b35","night":{"start":"21:00","end":"07:00","brightness":30}}}' | head -c 400
curl -s localhost:3344/api/device/config | grep -o '"night":{[^}]*}'
kill $SERVER_PID
```

Expected: both curls show `"night":{"start":"21:00","end":"07:00","brightness":30}`. Afterwards `git status` must NOT show a changed tracked file (`config/fleet.json` is gitignored — confirm the POST didn't touch anything tracked).

- [ ] **Step 3: Client evaluator behaves at mount** (preview, vite dev)

In preview on the kiosk root, inject a config whose night window is active right now and reload:

```js
// preview_eval — compute a window spanning "now", store it, reload:
const pad = (n) => String(n).padStart(2, '0');
const now = new Date();
const start = `${pad((now.getHours() + 23) % 24)}:00`;
const end = `${pad((now.getHours() + 2) % 24)}:00`;
const cfg = { deviceId: 'superclock-fast', enabledApps: [], instances: [],
  playlist: { items: [], rotationSeconds: null },
  settings: { theme: 'system', accent: '#ff8826', night: { start, end, brightness: 30 } },
  updatedAt: new Date().toISOString() };
localStorage.setItem('superclock:device-config', JSON.stringify(cfg));
location.reload();
```

Then `preview_eval`: `document.documentElement.className` → expect `"dark"` (mount-time `evaluate()` ran — no timer needed, which matters because the backgrounded preview suppresses intervals). Screenshot: Minimalismo black. Then set `theme: 'light'` the same way, reload → class `"light"`, face white. Finally `localStorage.removeItem('superclock:device-config'); location.reload()` to clean up. (In dev, the vite server has no `/api/device/config`, so the poll fails harmlessly and localStorage stays authoritative.)

- [ ] **Step 4: Deploy to fastclock and verify on-device**

```bash
bash scripts/deploy.sh nickv2026@superclock-fast.local
ssh nickv2026@superclock-fast.local 'cd ~/SuperClock && npm ci --omit=dev && sudo systemctl restart superclock-server.service'
ssh nickv2026@superclock-fast.local 'pkill -TERM chromium'   # reload kiosk
```

Then in the admin UI (`http://superclock-fast.local:3000/admin`): confirm the theme row shows **Auto** selected (migration ran), enable **Night mode** with a window starting ~2 min out, save. Within ~35 s of the start time the white faces flip dark and the panel dims (`journalctl -u superclock-server -g display-adapter` shows the brightness change). Set the window back to `21:00 → 07:00`, confirm faces flip back light and brightness restores.

- [ ] **Step 5: Commit anything outstanding, push, open PR**

```bash
git push -u origin claude/modest-kepler-c4ce48
gh pr create --title "feat: scheduled night mode (theme tokens + night brightness)" --body "## Summary

- \`settings.night: { start, end, brightness? }\` — per-device night window; \`theme: 'system'\` is now a real **Auto** mode (light by day, dark in the window). One-time fleet migration normalizes stored kiosk \`'dark'\` → \`'system'\` (theme was a visual no-op before this).
- White surfaces (Minimalismo, Complications Light, Quote) flip via \`--face-bg\`/\`--face-ink\` tokens under \`html.dark\`, with a 1s cross-fade. Gold/accent colors stay.
- Display-adapter applies \`night.brightness\` inside the window on its existing 30s loop; shared \`isWithinWindow\` helper replaces the adapter-local sleep-window code.
- Admin: Night mode card (window + brightness slider), \`night_mode\` feature flag, Auto label.
- deploy.sh now ships \`src/shared/\` (server imports runtime values from it — was a latent fresh-deploy crash).

Spec: docs/superpowers/specs/2026-06-12-night-mode-design.md · Plan: docs/superpowers/plans/2026-06-12-night-mode.md

## Test plan

- [ ] \`npm run build\` + \`npm run lint\` clean
- [ ] \`isWithinWindow\` spot-checks (wrap / same-day / boundaries / malformed / start==end / unset)
- [ ] Migration idempotence check in temp dir (kiosk dark→system, slow untouched, single version bump)
- [ ] Preview: three surfaces flip with forced \`dark\` class; evaluator sets class at mount from injected config
- [ ] On fastclock: Auto shown post-migration; window starting +2min flips faces + dims panel within ~35s; reverts after window

🤖 Generated with [Claude Code](https://claude.com/claude-code)"
```

---

## Spec-coverage map

| Spec section | Task |
|---|---|
| §1 Data model (`night`, theme semantics, `night_mode` flag) | 1 |
| §2 Shared window helper | 1 (created), 2 (adapter refactored onto it) |
| §3 Theme tokens + fade | 4 |
| §4 Kiosk evaluator | 4 |
| §5 Surface retrofit (Minimalismo / Complications Light / Quote) | 5 / 6 / 7 |
| §6 Server dimming | 2 |
| §7 Migration + default 'system' | 3 |
| §8 Admin UI (Auto label, Night card) | 8 |
| §9 deploy.sh `src/shared` | 9 |
| Verification | per-task + 10 |
