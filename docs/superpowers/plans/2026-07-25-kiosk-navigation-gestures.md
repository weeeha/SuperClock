# Kiosk Navigation Gestures Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement the approved gestures spec (`docs/specs/2026-07-24-kiosk-navigation-gestures-spec.md`): arc-zone gesture classification at drag start, a quick-settings overlay, a system back gesture, strict no-op for unclaimed vertical swipes, and idle self-recovery.

**Architecture:** A pure geometry module classifies every touch-start into inner-disc vs. one of four 90° rim arcs; `useGestures` stores the classification at `onDragStart` and branches `onDragEnd` on it. Settings is an overlay *flag* on the nav store (never a `mode`, so it can never strand `transitioning`); back is a registerable callback next to `verticalSwipeCallback`. Local brightness/night overrides live in a small persisted store consulted by the existing `apply-settings` CSS-filter layer.

**Tech Stack:** React 19, Zustand, @use-gesture/react, framer-motion, Vitest, Express 5.

**Out of scope (per spec):** sound row (endpoint undesigned — follow-up), wi-fi toggling, guest discoverability, the `slow` LVGL device. Pinch-in **stays** as a redundant grid entry (decided 2026-07-25) — do not remove it.

**Conventions that bind every task:** `import type` for type-only imports (verbatimModuleSyntax); no enums; gate timers on `isActive`/visibility; all gesture handling stays in the single root `@use-gesture/react` handler.

---

### Task 1: Gesture zone geometry (`gesture-zones.ts`)

Pure functions, no React. Zones: touch-start distance from center > (radius − ring width) ⇒ rim; rim splits into 90° arcs centered at 12/9/6 o'clock; right arc exists but maps to `inner` behavior (unassigned per spec).

**Files:**
- Create: `src/core/gesture-zones.ts`
- Test: `src/core/gesture-zones.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// src/core/gesture-zones.test.ts
import { describe, it, expect } from 'vitest';
import { classifyTouchStart, RING_FRACTION } from './gesture-zones';

// Viewport is 1080×1080 on-device; classification must scale with size,
// so tests use 1000×1000 for round numbers. radius=500, ring=500*RING_FRACTION.
const W = 1000;
const H = 1000;

describe('classifyTouchStart', () => {
  it('center of the screen is inner', () => {
    expect(classifyTouchStart(500, 500, W, H)).toBe('inner');
  });

  it('just inside the ring boundary is inner', () => {
    const innerEdge = 500 - 500 * RING_FRACTION - 1; // 1px inside the ring
    expect(classifyTouchStart(500 + innerEdge, 500, W, H)).toBe('inner');
  });

  it('top of the rim (12 o\'clock) is top-arc', () => {
    expect(classifyTouchStart(500, 10, W, H)).toBe('top-arc');
  });

  it('bottom of the rim (6 o\'clock) is bottom-arc', () => {
    expect(classifyTouchStart(500, 990, W, H)).toBe('bottom-arc');
  });

  it('left of the rim (9 o\'clock) is left-arc', () => {
    expect(classifyTouchStart(10, 500, W, H)).toBe('left-arc');
  });

  it('right of the rim (3 o\'clock) is right-arc', () => {
    expect(classifyTouchStart(990, 500, W, H)).toBe('right-arc');
  });

  it('rim at 45° (between top and right arcs) belongs to exactly one arc', () => {
    // 45° from vertical — the boundary. ±45° spans mean this is the seam;
    // it must classify (not throw) and be one of the two adjacent arcs.
    const d = 490 / Math.SQRT2;
    const zone = classifyTouchStart(500 + d, 500 - d, W, H);
    expect(['top-arc', 'right-arc']).toContain(zone);
  });

  it('corners of the square viewport (outside the disc) are rim arcs, not inner', () => {
    // A touch reported outside the disc entirely (square panel corners)
    // still classifies by angle.
    expect(classifyTouchStart(2, 2, W, H)).not.toBe('inner');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/core/gesture-zones.test.ts`
Expected: FAIL — `Cannot find module './gesture-zones'`

- [ ] **Step 3: Write the implementation**

```ts
// src/core/gesture-zones.ts
// Pure touch-start classification for the round kiosk viewport.
// Spec: docs/specs/2026-07-24-kiosk-navigation-gestures-spec.md — an outer
// ring (~70px of 1080, expressed as a fraction so it scales in dev windows)
// splits into 90° arcs at 12 / 6 / 9 o'clock. Classification happens at drag
// START; the right arc is unassigned and falls through to inner behavior at
// the gesture layer.

export type TouchZone = 'inner' | 'top-arc' | 'bottom-arc' | 'left-arc' | 'right-arc';

/** Ring width as a fraction of the disc radius (70/540). Tune on hardware. */
export const RING_FRACTION = 70 / 540;

/** Minimum inward travel (px at 1080) before an arc gesture may commit. */
export const ARC_MIN_TRAVEL = 80;

/** Peek progress (0..1 of sheet height) past which an arc gesture commits. */
export const COMMIT_PROGRESS = 0.4;

export function classifyTouchStart(
  x: number,
  y: number,
  width: number,
  height: number,
): TouchZone {
  const cx = width / 2;
  const cy = height / 2;
  const radius = Math.min(width, height) / 2;
  const dx = x - cx;
  const dy = y - cy;
  const dist = Math.hypot(dx, dy);

  if (dist <= radius * (1 - RING_FRACTION)) return 'inner';

  // Angle from 12 o'clock, clockwise, in degrees [0, 360).
  const deg = ((Math.atan2(dx, -dy) * 180) / Math.PI + 360) % 360;

  if (deg >= 315 || deg < 45) return 'top-arc';
  if (deg < 135) return 'right-arc';
  if (deg < 225) return 'bottom-arc';
  return 'left-arc';
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/core/gesture-zones.test.ts`
Expected: PASS (8 tests)

- [ ] **Step 5: Commit**

```bash
git add src/core/gesture-zones.ts src/core/gesture-zones.test.ts
git commit -m "feat(nav): pure arc-zone classification for touch starts"
```

---

### Task 2: Nav store — settings overlay flag, back callback, peek

Settings is an overlay **flag**, not a `NavMode` — it must be impossible for it to strand `mode: 'transitioning'` (the invariant `navigation.test.ts` exists to protect). Grid and settings are mutually exclusive.

**Files:**
- Modify: `src/core/navigation.ts`
- Test: `src/core/navigation.test.ts` (append a new describe block)

- [ ] **Step 1: Write the failing tests** (append to `src/core/navigation.test.ts`)

```ts
describe('quick-settings overlay + back gesture (spec 2026-07-24)', () => {
  it('showSettings opens only from app mode', () => {
    useNavigation.getState().showSettings();
    expect(useNavigation.getState().settingsOpen).toBe(true);
  });

  it('settings never touches mode — cannot strand transitioning', () => {
    useNavigation.getState().showSettings();
    expect(useNavigation.getState().mode).toBe('app');
    useNavigation.getState().hideSettings();
    expect(useNavigation.getState().mode).toBe('app');
  });

  it('settings and grid are mutually exclusive', () => {
    useNavigation.getState().showSettings();
    useNavigation.getState().showGrid();
    // grid opening closes settings
    expect(useNavigation.getState().settingsOpen).toBe(false);
    expect(useNavigation.getState().mode).toBe('grid');

    // and settings refuses to open over the grid
    useNavigation.getState().showSettings();
    expect(useNavigation.getState().settingsOpen).toBe(false);
  });

  it('showSettings is a no-op while transitioning', () => {
    useNavigation.getState().swipeToNext(); // mode: transitioning
    useNavigation.getState().showSettings();
    expect(useNavigation.getState().settingsOpen).toBe(false);
  });

  it('goBack with no registered callback is a strict no-op', () => {
    const before = useNavigation.getState();
    useNavigation.getState().goBack();
    expect(useNavigation.getState().mode).toBe(before.mode);
    expect(useNavigation.getState().activeAppId).toBe(before.activeAppId);
  });

  it('goBack invokes the registered callback', () => {
    let called = 0;
    useNavigation.getState().setBackCallback(() => { called += 1; });
    useNavigation.getState().goBack();
    expect(called).toBe(1);
    useNavigation.getState().setBackCallback(null);
  });

  it('overlay actions stamp lastGestureMs', () => {
    useNavigation.setState({ lastGestureMs: 0 });
    useNavigation.getState().showSettings();
    expect(useNavigation.getState().lastGestureMs).toBeGreaterThan(0);
  });
});
```

Also update the `beforeEach` to reset the new fields:

```ts
beforeEach(() => {
  useNavigation.setState({
    mode: 'app',
    activeInstanceId: null,
    transitionDirection: null,
    settingsOpen: false,
    backCallback: null,
    peek: null,
  });
  useNavigation.getState().initApps();
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/core/navigation.test.ts`
Expected: FAIL — `showSettings is not a function` (and TS errors on the new fields)

- [ ] **Step 3: Implement the store surface** (modify `src/core/navigation.ts`)

Add to the interface (after `lastGestureMs`):

```ts
  /** Quick-settings sheet — an overlay FLAG, deliberately not a NavMode:
   *  it must never interact with the transition contract below. */
  settingsOpen: boolean;
  /** Live drag progress (0..1) of an arc peek gesture, for peek-follow UI. */
  peek: { target: 'settings' | 'grid'; progress: number } | null;
  /** System back (left-arc swipe). Registered by drilled-in apps, same
   *  ownership pattern as verticalSwipeCallback — including guarded cleanup. */
  backCallback: (() => void) | null;
```

Add to the actions interface:

```ts
  showSettings: () => void;
  hideSettings: () => void;
  setPeek: (peek: { target: 'settings' | 'grid'; progress: number } | null) => void;
  setBackCallback: (fn: (() => void) | null) => void;
  goBack: () => void;
```

Add initial values + implementations inside `create()`:

```ts
  settingsOpen: false,
  peek: null,
  backCallback: null,

  showSettings: () => {
    const { mode, settingsOpen } = get();
    if (mode !== 'app' || settingsOpen) return;
    set({ settingsOpen: true, peek: null, lastGestureMs: Date.now() });
  },
  hideSettings: () => set({ settingsOpen: false, peek: null, lastGestureMs: Date.now() }),
  setPeek: (peek) => set({ peek }),
  setBackCallback: (fn) => set({ backCallback: fn }),
  goBack: () => {
    const { backCallback } = get();
    if (!backCallback) return; // no-op at app top level, per spec
    set({ lastGestureMs: Date.now() });
    backCallback();
  },
```

And make `showGrid` close settings (mutual exclusion):

```ts
  showGrid: () => set({ mode: 'grid', settingsOpen: false, peek: null, lastGestureMs: Date.now() }),
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/core/navigation.test.ts`
Expected: PASS (all previous invariants + 7 new)

- [ ] **Step 5: Commit**

```bash
git add src/core/navigation.ts src/core/navigation.test.ts
git commit -m "feat(nav): settings overlay flag, back callback, peek state"
```

---

### Task 3: Local overrides store (`local-overrides.ts`)

Quick-settings brightness/night must override fleet config **until the admin pushes a new value for that field**, then yield. Persisted so a reboot keeps the user's choice.

**Files:**
- Create: `src/core/local-overrides.ts`
- Test: `src/core/local-overrides.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// src/core/local-overrides.test.ts
import { describe, it, expect, beforeEach } from 'vitest';
import { useLocalOverrides, effectiveBrightness, effectiveNight } from './local-overrides';

beforeEach(() => {
  useLocalOverrides.setState({ brightness: null, night: null });
});

describe('brightness override', () => {
  it('no override → config value wins', () => {
    expect(effectiveBrightness(80)).toBe(80);
  });

  it('override wins over the config value it was set against', () => {
    useLocalOverrides.getState().setBrightness(40, 80); // user picks 40 while config says 80
    expect(effectiveBrightness(80)).toBe(40);
  });

  it('a NEW config value clears the override (admin wins)', () => {
    useLocalOverrides.getState().setBrightness(40, 80);
    expect(effectiveBrightness(60)).toBe(60); // config changed 80→60 → override dropped
    expect(useLocalOverrides.getState().brightness).toBeNull();
  });
});

describe('night override', () => {
  it('no override → scheduled value wins', () => {
    expect(effectiveNight(true)).toBe(true);
  });

  it('override wins until the schedule next flips', () => {
    useLocalOverrides.getState().setNight(true, false); // force night ON while schedule says day
    expect(effectiveNight(false)).toBe(true);
    // schedule flips to night on its own → override is spent, schedule resumes
    expect(effectiveNight(true)).toBe(true);
    expect(useLocalOverrides.getState().night).toBeNull();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/core/local-overrides.test.ts`
Expected: FAIL — `Cannot find module './local-overrides'`

- [ ] **Step 3: Write the implementation**

```ts
// src/core/local-overrides.ts
// Kiosk-local quick-settings overrides. Each override remembers the config /
// scheduled value it was set AGAINST; when that base value changes (admin
// push, night boundary), the override is spent and the base resumes. This
// keeps the admin authoritative without a sync protocol.
import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface Override<T> {
  value: T;
  /** The base (config/scheduled) value at the moment the user overrode it. */
  base: T;
}

interface LocalOverridesState {
  brightness: Override<number> | null;
  night: Override<boolean> | null;
  setBrightness: (value: number, base: number) => void;
  setNight: (value: boolean, base: boolean) => void;
}

export const useLocalOverrides = create<LocalOverridesState>()(
  persist(
    (set) => ({
      brightness: null,
      night: null,
      setBrightness: (value, base) => set({ brightness: { value, base } }),
      setNight: (value, base) => set({ night: { value, base } }),
    }),
    { name: 'kiosk:local-overrides' },
  ),
);

/** Resolve brightness: override wins until config moves off its base. */
export function effectiveBrightness(configValue: number | undefined): number | undefined {
  const o = useLocalOverrides.getState().brightness;
  if (!o) return configValue;
  if (configValue !== o.base) {
    useLocalOverrides.setState({ brightness: null });
    return configValue;
  }
  return o.value;
}

/** Resolve night: override wins until the schedule next changes. */
export function effectiveNight(scheduled: boolean): boolean {
  const o = useLocalOverrides.getState().night;
  if (!o) return scheduled;
  if (scheduled !== o.base) {
    useLocalOverrides.setState({ night: null });
    return scheduled;
  }
  return o.value;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/core/local-overrides.test.ts`
Expected: PASS (5 tests)

- [ ] **Step 5: Commit**

```bash
git add src/core/local-overrides.ts src/core/local-overrides.test.ts
git commit -m "feat(nav): persisted local brightness/night overrides that yield to admin"
```

---

### Task 4: `apply-settings` consumes the overrides

**Files:**
- Modify: `src/core/apply-settings.ts` (the `isNight` derivation ~line 40 and the brightness effect ~line 71)

- [ ] **Step 1: Wire overrides in** — in `useApplySettings`:

Subscribe to the override store (so the effect re-runs when the user drags the slider):

```ts
import { useLocalOverrides, effectiveBrightness, effectiveNight } from './local-overrides';
```

```ts
  // re-render when overrides change (values consumed via effective* below)
  useLocalOverrides((s) => s.brightness);
  useLocalOverrides((s) => s.night);
```

Where `isNight` is computed from the window (keep the existing scheduled computation, then wrap):

```ts
  const scheduledNight =
    nightStart !== undefined &&
    nightEnd !== undefined &&
    isWithinWindow({ start: nightStart, end: nightEnd }, new Date());
  const isNight = effectiveNight(scheduledNight);
```

Where the brightness pct is chosen (existing line: `isNight && typeof nightBrightness === 'number' ? nightBrightness : dayBrightness`):

```ts
    const basePct =
      isNight && typeof nightBrightness === 'number' ? nightBrightness : dayBrightness;
    const pct = effectiveBrightness(basePct);
```

(Keep the existing ≥100/unset → unfiltered behavior downstream untouched.)

- [ ] **Step 2: Run the full suite + lint**

Run: `npx vitest run && npm run lint`
Expected: PASS / clean. (No new tests here — the resolution logic is covered by Task 3; this task is pure wiring.)

- [ ] **Step 3: Commit**

```bash
git add src/core/apply-settings.ts
git commit -m "feat(nav): apply-settings honors quick-settings overrides"
```

---

### Task 5: Wi-Fi status endpoint (`/api/device/network`)

Status **only** — no mutation surface, per spec decision 3b.

**Files:**
- Modify: `server/api-mount.ts` (add route next to `/api/health`)

- [ ] **Step 1: Add the route**

```ts
import { execFile } from 'node:child_process';
```

```ts
  // Wi-Fi STATUS for the kiosk quick-settings sheet. Read-only by design:
  // a network toggle on a device administered over wifi is a footgun
  // (spec 2026-07-24, decision 3b).
  app.get('/api/device/network', (_req, res) => {
    execFile('iwgetid', ['-r'], { timeout: 2000 }, (err, stdout) => {
      const ssid = err ? null : stdout.trim() || null;
      res.json({ ssid, connected: ssid !== null });
    });
  });
```

- [ ] **Step 2: Verify by hand**

Run: `npm run start:src` then `curl -s localhost:3000/api/device/network`
Expected (dev Mac, no iwgetid): `{"ssid":null,"connected":false}` — the honest dev answer. On a Pi it returns the SSID.

- [ ] **Step 3: Commit**

```bash
git add server/api-mount.ts
git commit -m "feat(server): read-only /api/device/network for quick-settings wifi row"
```

---

### Task 6: Gesture layer — classify at drag start, arc branches, strict no-op

The heart of the change. `onDragStart` classifies and stores the zone; `onDrag` feeds peek progress for bottom/top arcs; `onDragEnd` branches on the stored zone. The old "vertical swipe with no callback opens the grid" fallback **dies here**. Pinch-in and 3-finger tap are untouched.

**Files:**
- Modify: `src/core/hooks/useGestures.ts`

- [ ] **Step 1: Replace the drag handlers** (keep the context-menu effect, 3-finger effect, and pinch handlers exactly as they are)

```ts
import { classifyTouchStart, ARC_MIN_TRAVEL, COMMIT_PROGRESS } from '../gesture-zones';
import type { TouchZone } from '../gesture-zones';
```

Inside `useAppGestures`, before `useGesture`:

```ts
  // Zone is decided at drag START (spec: origin owns the gesture) and
  // consumed at drag end. Ref, not state — gestures must not re-render.
  const zoneRef = useRef<TouchZone>('inner');
  // Sheet height the peek progress is measured against (half the disc).
  const sheetHeight = () => window.innerHeight / 2;
```

New handlers object for `useGesture` (replacing only `onDragEnd`; `onPinchStart`/`onPinch` stay):

```ts
      onDragStart: ({ xy: [x, y] }) => {
        zoneRef.current = classifyTouchStart(x, y, window.innerWidth, window.innerHeight);
      },
      onDrag: ({ movement: [, my] }) => {
        const { mode, settingsOpen, setPeek } = useNavigation.getState();
        if (mode !== 'app' || settingsOpen) return;
        // Peek-follow: bottom arc drags the settings sheet up with the finger.
        if (zoneRef.current === 'bottom-arc' && my < 0) {
          setPeek({ target: 'settings', progress: Math.min(1, -my / sheetHeight()) });
        }
      },
      onDragEnd: ({ movement: [mx, my], velocity: [vx, vy] }) => {
        const nav = useNavigation.getState();
        const zone = zoneRef.current;
        zoneRef.current = 'inner';
        nav.setPeek(null);

        // ---- Settings open: only dismissal gestures exist ----
        if (nav.settingsOpen) {
          if (my > SWIPE_THRESHOLD) nav.hideSettings(); // swipe down dismisses
          return;
        }

        // ---- Arc gestures (system) — origin-in-arc + inward travel ≥ 80px ----
        if (nav.mode === 'app' && zone === 'bottom-arc' && -my >= ARC_MIN_TRAVEL) {
          if (-my / sheetHeight() >= COMMIT_PROGRESS) nav.showSettings();
          return; // sub-threshold = snap back (peek already cleared)
        }
        if (nav.mode === 'app' && zone === 'top-arc' && my >= ARC_MIN_TRAVEL) {
          nav.showGrid();
          return;
        }
        if (nav.mode === 'app' && zone === 'left-arc' && mx >= ARC_MIN_TRAVEL) {
          nav.goBack(); // strict no-op when no app registered a back callback
          return;
        }
        // right-arc: unassigned — falls through to inner behavior below.

        const absX = Math.abs(mx);
        const absY = Math.abs(my);

        // ---- Inner vertical: app-owned or STRICT NO-OP (spec decision 2a) ----
        if (absY > absX && absY > SWIPE_THRESHOLD && Math.abs(vy) > SWIPE_VELOCITY) {
          if (nav.mode === 'app' && nav.verticalSwipeCallback) {
            nav.verticalSwipeCallback(my > 0 ? 'down' : 'up');
          } else if (my < 0 && nav.mode === 'grid') {
            nav.hideGrid(); // grid dismissal keeps its swipe-up
          }
          // NO else-showGrid: unclaimed vertical is a no-op now. The grid is
          // reachable via top arc, 3-finger tap, and (kept) pinch-in.
          return;
        }

        // ---- Inner horizontal: switch apps (unchanged) ----
        if (nav.mode !== 'app') return;
        if (absX < SWIPE_THRESHOLD || Math.abs(vx) < SWIPE_VELOCITY) return;
        if (mx < 0) nav.swipeToNext();
        else nav.swipeToPrev();
      },
```

- [ ] **Step 2: Run suite + lint**

Run: `npx vitest run && npm run lint`
Expected: PASS / clean (react-hooks v7 ruleset is strict — `zoneRef`/`sheetHeight` must not trip it; `sheetHeight` is a plain closure, fine).

- [ ] **Step 3: Manual dev-server check (Chrome)**

Run: dev server via `.claude/launch.json` (port 5180). In the browser console:
- Drag from center vertically in an app with no vertical callback (Fireplace) → **nothing happens** (was: grid).
- Drag down starting at the top rim → grid opens. `window.__nav.getState().mode` → `'grid'`.
- Drag up from center in ClockApp → face cycles (app-owned vertical intact).
- Pinch-in → grid still opens.

- [ ] **Step 4: Commit**

```bash
git add src/core/hooks/useGestures.ts
git commit -m "feat(nav): arc-zone gestures, classify at drag start, strict no-op vertical"
```

---

### Task 7: Quick-settings sheet component + mount

Bottom sheet over the lower half-disc: brightness slider, night toggle, wi-fi status row. Follows the peek progress while dragging; framer-motion animates commit/dismiss. Content styled with kiosk theme tokens (`src/index.css` `@theme`), matching wireframe `49:626`.

**Files:**
- Create: `src/core/components/QuickSettings.tsx`
- Modify: `src/App.tsx`

- [ ] **Step 1: Create the component**

```tsx
// src/core/components/QuickSettings.tsx
import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigation } from '../navigation';
import { useLocalOverrides } from '../local-overrides';
import { useDeviceConfig } from '../device-config';

interface NetworkStatus {
  ssid: string | null;
  connected: boolean;
}

export default function QuickSettings() {
  const settingsOpen = useNavigation((s) => s.settingsOpen);
  const peek = useNavigation((s) => s.peek);
  const hideSettings = useNavigation((s) => s.hideSettings);
  const config = useDeviceConfig();
  const setBrightness = useLocalOverrides((s) => s.setBrightness);
  const setNight = useLocalOverrides((s) => s.setNight);
  const brightnessOverride = useLocalOverrides((s) => s.brightness);
  const nightOverride = useLocalOverrides((s) => s.night);

  const configBrightness = config?.settings.brightness ?? 100;
  const brightness = brightnessOverride?.value ?? configBrightness;
  const nightOn = nightOverride?.value ?? false;

  const [net, setNet] = useState<NetworkStatus | null>(null);
  useEffect(() => {
    if (!settingsOpen) return; // active-aware: no fetch while closed
    let cancelled = false;
    fetch('/api/device/network')
      .then((r) => r.json())
      .then((d: NetworkStatus) => { if (!cancelled) setNet(d); })
      .catch(() => { if (!cancelled) setNet({ ssid: null, connected: false }); });
    return () => { cancelled = true; };
  }, [settingsOpen]);

  const peeking = peek?.target === 'settings' ? peek.progress : 0;

  return (
    <AnimatePresence>
      {(settingsOpen || peeking > 0) && (
        <>
          {settingsOpen && (
            // Tap anywhere above the sheet to dismiss
            <div className="absolute inset-0 z-40" onPointerDown={hideSettings} />
          )}
          <motion.div
            className="absolute inset-x-0 bottom-0 z-50 h-1/2 rounded-t-[50%_20%] bg-neutral-900/95 px-[14%] pt-[8%] backdrop-blur"
            initial={{ y: '100%' }}
            animate={{ y: settingsOpen ? '0%' : `${(1 - peeking) * 100}%` }}
            exit={{ y: '100%' }}
            transition={settingsOpen ? { type: 'spring', stiffness: 300, damping: 32 } : { duration: 0 }}
          >
            <div className="mx-auto mb-6 h-2 w-16 rounded-full bg-white/25" />

            <label className="block font-mono text-[2vmin] tracking-widest text-white/50">
              BRIGHTNESS
              <input
                type="range"
                min={20}
                max={100}
                value={brightness}
                onChange={(e) => setBrightness(Number(e.target.value), configBrightness)}
                className="mt-2 w-full accent-white"
              />
            </label>

            <div className="mt-5 flex items-center justify-between">
              <span className="font-mono text-[2vmin] tracking-widest text-white/50">NIGHT MODE</span>
              <button
                type="button"
                aria-pressed={nightOn}
                onClick={() => setNight(!nightOn, nightOn)}
                className={`h-11 w-20 rounded-full transition-colors ${nightOn ? 'bg-white/80' : 'bg-white/15'}`}
              >
                <span
                  className={`block h-9 w-9 rounded-full bg-black transition-transform ${nightOn ? 'translate-x-10' : 'translate-x-1'}`}
                />
              </button>
            </div>

            <div className="mt-5 flex items-center justify-between">
              <span className="font-mono text-[2vmin] tracking-widest text-white/50">WI-FI</span>
              <span className="text-[2.2vmin] text-white/70">
                {net === null ? '…' : net.connected ? `${net.ssid} · connected` : 'not connected'}
              </span>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
```

Note on the night toggle's `base` argument: the sheet passes the *currently effective* value as base, which spends the override correctly the next time the schedule flips (Task 3 semantics).

- [ ] **Step 2: Mount in `src/App.tsx`** (after the grid's AnimatePresence, before `PresenceShade`)

```tsx
import QuickSettings from './core/components/QuickSettings';
```

```tsx
      <QuickSettings />
```

- [ ] **Step 3: Verify in the dev browser**

- Swipe up from the bottom rim slowly → sheet follows the finger; release below ~40% → snaps away; past 40% → commits open.
- Drag the brightness slider → page visibly dims (CSS filter on `<html>`).
- Tap above the sheet → dismisses. `window.__nav.getState().settingsOpen` → `false`.
- Check console for errors; check the network row shows `not connected` in dev (honest — no iwgetid on the Mac).

- [ ] **Step 4: Run suite + lint + build**

Run: `npx vitest run && npm run lint && npm run build`
Expected: all green.

- [ ] **Step 5: Commit**

```bash
git add src/core/components/QuickSettings.tsx src/App.tsx
git commit -m "feat(nav): quick-settings sheet with peek-follow, brightness, night, wifi status"
```

---

### Task 8: Idle return (`useIdleReturn.ts`)

Two timers, both driven by `lastGestureMs`: overlays self-dismiss after 20 s; the whole kiosk returns to the default face after 5 min. One interval, gated on document visibility (kiosks run for weeks — no leaked timers).

**Files:**
- Create: `src/core/hooks/useIdleReturn.ts`
- Test: `src/core/hooks/useIdleReturn.test.ts`
- Modify: `src/App.tsx`

- [ ] **Step 1: Write the failing test**

```ts
// src/core/hooks/useIdleReturn.test.ts
import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { useNavigation } from '../navigation';
import { checkIdle, OVERLAY_IDLE_MS, HOME_IDLE_MS } from './useIdleReturn';
import '../../apps';

beforeEach(() => {
  vi.useFakeTimers();
  useNavigation.setState({
    mode: 'app', activeInstanceId: null, transitionDirection: null,
    settingsOpen: false, backCallback: null, peek: null,
    lastGestureMs: Date.now(),
  });
  useNavigation.getState().initApps();
});
afterEach(() => vi.useRealTimers());

describe('checkIdle', () => {
  it('dismisses an idle overlay after OVERLAY_IDLE_MS', () => {
    useNavigation.getState().showGrid();
    vi.advanceTimersByTime(OVERLAY_IDLE_MS + 1000);
    checkIdle();
    expect(useNavigation.getState().mode).toBe('app');
  });

  it('leaves a fresh overlay alone', () => {
    useNavigation.getState().showGrid();
    vi.advanceTimersByTime(OVERLAY_IDLE_MS / 2);
    checkIdle();
    expect(useNavigation.getState().mode).toBe('grid');
  });

  it('returns to the first app after HOME_IDLE_MS', () => {
    const home = useNavigation.getState().appOrder[0];
    useNavigation.getState().swipeToNext();
    useNavigation.getState().finishTransition();
    vi.advanceTimersByTime(HOME_IDLE_MS + 1000);
    checkIdle();
    // switchToApp enters transitioning toward home
    expect(useNavigation.getState().activeAppId).toBe(home);
  });

  it('never fires home-return mid-transition', () => {
    useNavigation.getState().swipeToNext(); // mode: transitioning
    vi.advanceTimersByTime(HOME_IDLE_MS + 1000);
    checkIdle();
    // must not stack a second transition on top of an in-flight one
    expect(useNavigation.getState().mode).toBe('transitioning');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/core/hooks/useIdleReturn.test.ts`
Expected: FAIL — `Cannot find module './useIdleReturn'`

- [ ] **Step 3: Write the implementation**

```ts
// src/core/hooks/useIdleReturn.ts
// Spec: overlays self-dismiss after 20s untouched; the kiosk returns to the
// default face after ~5min. Single 5s interval, visibility-gated.
import { useEffect } from 'react';
import { useNavigation } from '../navigation';

export const OVERLAY_IDLE_MS = 20_000;
export const HOME_IDLE_MS = 5 * 60_000;

/** Exported for tests — one idle sweep against the nav store. */
export function checkIdle(): void {
  const nav = useNavigation.getState();
  if (nav.lastGestureMs === 0) return;
  const idle = Date.now() - nav.lastGestureMs;

  if (idle > OVERLAY_IDLE_MS) {
    if (nav.mode === 'grid') nav.hideGrid();
    if (nav.settingsOpen) nav.hideSettings();
  }

  if (idle > HOME_IDLE_MS && nav.mode === 'app') {
    const home = nav.appOrder[0];
    if (home && nav.activeAppId !== home) nav.switchToApp(home);
  }
}

export function useIdleReturn(): void {
  useEffect(() => {
    let id: ReturnType<typeof setInterval> | null = null;
    const start = () => { if (!id) id = setInterval(checkIdle, 5000); };
    const stop = () => { if (id) { clearInterval(id); id = null; } };
    const onVisibility = () => (document.hidden ? stop() : start());
    document.addEventListener('visibilitychange', onVisibility);
    start();
    return () => { stop(); document.removeEventListener('visibilitychange', onVisibility); };
  }, []);
}
```

Gotcha the last test pins: `hideGrid`/`hideSettings` stamp `lastGestureMs`, so an overlay dismissal resets the 5-min home clock — the two timers chain rather than fire together. That is intended (dismissal is "activity" as far as home-return is concerned; the kiosk still lands home within ~5:20 worst case).

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/core/hooks/useIdleReturn.test.ts`
Expected: PASS (4 tests)

- [ ] **Step 5: Mount in `src/App.tsx`** next to the other hooks

```tsx
import { useIdleReturn } from './core/hooks/useIdleReturn';
```

```tsx
  useIdleReturn();
```

- [ ] **Step 6: Full suite + commit**

Run: `npx vitest run && npm run lint`

```bash
git add src/core/hooks/useIdleReturn.ts src/core/hooks/useIdleReturn.test.ts src/App.tsx
git commit -m "feat(nav): idle return — 20s overlay dismiss, 5min home"
```

---

### Task 9: Calendar becomes the reference back-gesture consumer

CalendarApp's drill-down (day → details) currently renders its own `BackChevron`. Per spec, apps never render back chrome — Calendar registers `backCallback` while drilled in, with the **guarded cleanup** pattern (capture the callback in a const; only null the slot if it's still yours — `popLayout` keeps exiting apps mounted, an unconditional null stomps the next app's registration; see CLAUDE.md on `verticalSwipeCallback`).

**Files:**
- Modify: `src/apps/calendar/CalendarApp.tsx`
- Delete usage of: `src/apps/calendar/BackChevron.tsx` (delete the file once unreferenced)

- [ ] **Step 1: Register the back callback** — in `CalendarApp`, alongside the existing vertical-swipe registration effect, add (adapting names to the actual drill state in the file — the effect must depend on `isActive` and the drill state):

```tsx
  const setBackCallback = useNavigation((s) => s.setBackCallback);

  useEffect(() => {
    if (!isActive || !drill) {
      return;
    }
    const cb = () => {
      // same destination the BackChevron used: leave details → day → grid view
      exitDrill(); // ← use the component's existing "go up one level" handler
    };
    setBackCallback(cb);
    return () => {
      if (useNavigation.getState().backCallback === cb) {
        setBackCallback(null);
      }
    };
  }, [isActive, drill, setBackCallback]);
```

(`exitDrill` stands for whatever function the `BackChevron`'s `onClick` currently calls — reuse it verbatim so the destination is identical. Read the component before editing; do not invent a new path.)

- [ ] **Step 2: Remove BackChevron renders** from the drilled views' JSX in `CalendarApp.tsx` / `DayView.tsx` / `DetailsView.tsx` (wherever it is rendered), then delete `src/apps/calendar/BackChevron.tsx` when `grep -rn "BackChevron" src/` shows no references.

- [ ] **Step 3: Verify in dev browser**

- Calendar → drill into a day → swipe right from the left rim → returns up one level; repeat to surface. No chevron anywhere.
- Left-arc swipe at calendar top level → nothing (strict no-op, callback unregistered).
- Switch apps mid-drill, then back to calendar → back gesture still works (guarded cleanup didn't stomp).

- [ ] **Step 4: Full suite + lint + commit**

Run: `npx vitest run && npm run lint`

```bash
git add -A src/apps/calendar
git commit -m "feat(calendar): system back gesture replaces BackChevron"
```

---

### Task 10: Docs + final verification

**Files:**
- Modify: `CLAUDE.md` (Navigation state + Gestures sections)
- Modify: `docs/specs/2026-07-24-kiosk-navigation-gestures-spec.md` (changelog)

- [ ] **Step 1: Update CLAUDE.md** — in the **Gestures** section, replace the description of vertical-swipe fallback with the new grammar: classification at drag start via `gesture-zones.ts`; arcs = grid (top) / settings (bottom) / back (left); unclaimed inner vertical = strict no-op; pinch-in kept as redundant grid entry; `backCallback` registration mirrors `verticalSwipeCallback` including guarded cleanup; quick-settings is an overlay flag with local overrides that yield to admin pushes.

- [ ] **Step 2: Append to the spec changelog**

```markdown
- 2026-07-25 — implemented (plan docs/superpowers/plans/2026-07-25-kiosk-navigation-gestures.md). Ring/arc geometry constants live in src/core/gesture-zones.ts pending hardware tuning on fastclock.
```

- [ ] **Step 3: Full gate**

Run: `npx vitest run && npm run lint && npm run build`
Expected: all green — registry coherence, navigation invariants, new zone/override/idle tests.

- [ ] **Step 4: Cross-browser dev check** (Chrome + Safari, per Nick's standing rule): open the dev server in both, walk the Task 6/7/9 manual checks once each.

- [ ] **Step 5: Commit**

```bash
git add CLAUDE.md docs/specs/2026-07-24-kiosk-navigation-gestures-spec.md
git commit -m "docs: navigation grammar v2 in CLAUDE.md + spec changelog"
```

---

## Self-review notes

- **Spec coverage:** zones/classification (T1, T6), one-gesture-one-outcome + strict no-op (T6, pinned by T2/T8 tests), quick-settings incl. brightness/night/wifi-status (T3-T5, T7), peek-follow + 40%/80px thresholds (T6, T7), back gesture + reference consumer (T2, T9), panic 3-finger (already exists, untouched), idle return (T8), pinch-in kept (T6 explicitly preserves), test pinning (T1, T2, T3, T8). Sound row: out of scope per spec open question.
- **Grid peek-follow** is intentionally commit-threshold-only in v1 (the grid keeps its opacity/scale entrance); the sheet gets true finger-follow. The misfire-mitigation goal (grazes invisible) is met for both via the 80px + 40% gate. Noted as acceptable divergence; revisit at hardware tuning.
- **Type consistency check:** `TouchZone`, `ARC_MIN_TRAVEL`, `COMMIT_PROGRESS` defined in T1, consumed in T6. `showSettings/hideSettings/setPeek/goBack/setBackCallback` defined in T2, consumed in T6-T9. `effectiveBrightness/effectiveNight/useLocalOverrides` defined in T3, consumed in T4/T7. `checkIdle/OVERLAY_IDLE_MS/HOME_IDLE_MS` defined and consumed in T8.
