# Night Mode — Scheduled Dark Theme + Night Brightness — Design

**Date:** 2026-06-12
**Status:** Approved (design)

## Problem

The pure-white surfaces — **Minimalismo** and **Complications Light** clock faces, plus the **Quote** app — are blinding at night on a bedside/desk kiosk. The plumbing for a fix half-exists and is currently dead weight:

- `DeviceConfig.settings.theme: 'light' | 'dark' | 'system'` is stored, feature-flagged, and editable in the admin — but `useApplySettings` only toggles a `light`/`dark` class on `<html>` that **no CSS consumes**, and `'system'` is a stub that falls back to dark.
- `settings.sleepSchedule` turns the panel fully **off** at night via the display-adapter, but in the evening hours before sleep the white faces glare at full brightness.

## Decisions (from brainstorm, 2026-06-12)

| Question | Decision |
|---|---|
| Trigger | Per-device **schedule window** set in admin (no sunset/sunrise in v1) |
| Scope | Minimalismo, Complications Light, Quote app |
| Night look | **Invert in place** — each face keeps its identity, palette flips |
| Dimming | **Yes** — optional night brightness % via the existing display-adapter |
| Mechanism | Finish the theme system: CSS tokens + scheduled `html.dark` class |

## Approach

Make the existing theme machinery real instead of adding a parallel one. A new `settings.night` window drives the (currently no-op) `dark` class on a schedule; the three white surfaces are retrofitted to semantic color tokens that flip under `html.dark` with a soft cross-fade; the server's display-adapter — which already re-evaluates a time window every 30 s for sleep — picks a night brightness inside the same window.

## Components

### 1. Data model (`src/shared/types.ts`)

```ts
settings: {
  theme: 'light' | 'dark' | 'system';   // existing — semantics defined below
  accent: string;
  brightness?: number;
  sleepSchedule?: { wake: string; sleep: string };
  night?: { start: string; end: string; brightness?: number };  // NEW
}
```

- `night.start` / `night.end`: 24 h `HH:MM` strings (same format as `sleepSchedule`). Admin default when enabled: `21:00 → 07:00`.
- `night.brightness`: integer 0–100 applied **during** the window; `undefined` → no night dimming (recolor only). Admin default when enabled: 30.
- **Theme semantics:** `'light'` → always light; `'dark'` → always dark; `'system'` (rendered as **“Auto”** in the admin) → dark inside the night window, light outside. `'system'` with no `night` configured → always light, which matches today’s rendered look.
- `FeatureFlag` union gains `'night_mode'`; the three kiosk devices get it in `capabilities.ts`. The `slow` LVGL device does not.

### 2. Shared window helper (`src/shared/time-window.ts`)

`isWithinWindow({ start, end }, now): boolean` — extracted from the display-adapter’s `isWithinSleepWindow`, preserving its behavior exactly: minute-of-day comparison, midnight wrap (`21:00 → 07:00`), malformed `HH:MM` or `start === end` → `false`. The display-adapter refactors onto it (mapping `{ sleep → start, wake → end }`), so there is exactly one tested midnight-wrap implementation shared by client and server.

### 3. Theme tokens (`src/index.css`)

```css
:root, html.light {
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
```

Themed elements get a `theme-fade` treatment: `transition: background-color 1s, fill 1s, stroke 1s, color 1s` so the flip is a gentle cross-fade, not a snap. Constraint: `var()` does **not** work in SVG presentation attributes — themed fills/strokes move to classes or `style` (Tailwind v4 `fill-(--face-ink)` / `bg-(--face-bg)` syntax).

### 4. Kiosk evaluator (`src/core/apply-settings.ts`)

`useApplySettings` extends: a 30 s interval recomputes `isNight = isWithinWindow(config.settings.night, new Date())`, and the `<html>` class becomes `theme === 'dark' ? dark : theme === 'light' ? light : (isNight ? 'dark' : 'light')`. (The `setInterval` ESLint ban is scoped to `src/apps/clock` — core is fine.) Propagation budget: ≤ 5 s config poll + ≤ 30 s evaluator tick at the boundary. Works offline: config is cached in localStorage and the clock is local.

### 5. Surface retrofit (invert in place)

- **`MinimalismoClock.tsx`** — wrapper `bg-white` → `bg-(--face-bg)`; face circle `#FFFFFF` → `var(--face-bg)`; hour/minute strokes `#000000` → `var(--face-ink)`; **gold second hand `#FFD700` stays literal**.
- **`ComplicationsLight.tsx`** — face circle `white` → `var(--face-bg)`; ticks `#444` → `var(--face-tick)`; brand mark `#666` → `var(--face-tick)`. Everything else stays literal: the `#1a1a1a` complication discs (subtle elevation on black), the white-bordered dark hands (read well on both grounds), accents (`#22c55e`, `#fbbf24`, `#f59e0b`), and in-disc text.
- **`QuoteApp.tsx`** — `bg-white` → `bg-(--face-bg)`; `text-gray-600` → `text-(--face-ink-muted)`; `text-gray-900` → `text-(--face-ink)`. Portraits and the initials gradient are unchanged.

All other faces are already dark and are untouched.

### 6. Server dimming (`server/display-adapter.ts`)

In `reconcile`, effective brightness becomes:

```
isWithinWindow(night) && night.brightness != null ? night.brightness : settings.brightness
```

The existing diff-before-shelling-out, 30 s tick, output detection, and sleep handling are unchanged. During a sleep/night overlap the panel is simply off; on wake inside the night window the existing “re-assert brightness after wake” path applies the night value. Night dimming is schedule-driven, independent of the `theme` value (a manually-dark device still dims at night).

### 7. Migration (`server/fleet-store.ts`, `src/shared/types.ts`)

- `emptyDeviceConfig` default `theme` changes `'dark'` → `'system'`.
- One-time normalization on fleet load (guarded by a `FleetConfig.version` bump): kiosk devices with stored `theme: 'dark'` become `'system'`. Rationale: theme has been a visual no-op, so stored values carry no real intent; normalizing preserves today’s daytime look and adds the night flip. The `slow` device’s config is untouched.

### 8. Admin UI (`src/admin/routes/Settings.tsx`)

- Theme selector: wire value `'system'` renders the label **Auto** (no type change).
- New **Night mode** block in the Display card, beside Sleep schedule: a Switch (on → seeds `{ start: '21:00', end: '07:00', brightness: 30 }`, off → `undefined`), start/end `<input type="time">`, and a “Night brightness” slider 0–100 step 5 (set it to 100 for recolor-only behavior). Gated by `has('night_mode')`.

### 9. Deploy prerequisite (`scripts/deploy.sh`)

The server imports **values** from `../src/shared/` but deploy.sh does not ship `src/` — existing Pis only run because of leftover state, and `isWithinWindow` adds another value import. Add `src/shared/` to the rsync payload as part of this work; without it a fresh deploy of night brightness crashes the server.

## Edge cases

- `night.start === night.end`, or malformed `HH:MM` → never night (mirrors sleep-schedule behavior).
- Window wrapping midnight is the **default** configuration and is handled by the shared helper.
- DST: minute-of-day comparison shifts the boundary by an hour twice a year — accepted, same as sleep schedule.
- Manual `theme: 'light'` during the night window → face stays light but night brightness still dims (deliberate: dimming is a display concern, recolor is a theme concern).
- Kiosk offline: theme flip and dimming both keep working (cached config, local clock, server co-located on the Pi).

## Out of scope (v1)

- **`slow` LVGL device** — its native Minimalismo stays white at night; needs a C-side theme (follow-up).
- Sunset/sunrise trigger (would need location + sun math).
- Theming the remaining apps/faces and AppGrid — the tokens make opt-in cheap later.
- True backlight control — the panel exposes no backlight device, and (per the 2026-06-12 amendment) `wlr-randr` has no brightness flag at all; night dimming is a client-side CSS filter, day brightness is a tracked follow-up.

## Verification

No test runner is configured in this repo.

1. `npm run build` + `npm run lint` clean.
2. `isWithinWindow` spot-checked directly (wrap, same-day, invalid, boundary minutes) via `node --import tsx -e`.
3. Preview: force `html.dark` and confirm all three surfaces flip with the cross-fade; the preview tab suppresses timers, so the evaluator is exercised by direct invocation / a temporarily-near window, not by waiting.
4. On-device (**fastclock**): set a night window starting ~2 min out via admin → watch recolor + dim land within ~35 s; verify morning un-flip, midnight wrap, sleep-overlap wake behavior, and that Minimalismo’s gold hand stays gold on black.
5. Admin: Night mode card gates on the flag, saves round-trip, Auto label renders for `'system'`.

## Amendment — 2026-06-12 (post-verification)

On-device verification found that `wlr-randr` has no `--brightness` option in
any released version (0.4.1 is current; the man page lists only
mode/position/scale/on/off). The display-adapter's gamma plan — and the
pre-existing day-brightness slider — never worked on real hardware. Decision
(user-approved): **night dimming is client-side** — the kiosk applies
`filter: brightness(night.brightness / 100)` on `<html>` while the window is
active (independent of theme, clamped 0–100, 1 s fade), implemented in the
same evaluator that owns the dark class. The display-adapter no longer reads
`settings.night`; it keeps day brightness (still broken on current wlroots
tooling — tracked as a follow-up) and the sleep schedule (works; `--on/--off`
are real flags). On this fixed-backlight LCD, CSS dimming is visually
equivalent to compositor gamma. §6 above is superseded accordingly.
