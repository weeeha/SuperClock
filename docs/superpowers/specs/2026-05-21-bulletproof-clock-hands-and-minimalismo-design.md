# Bulletproof Clock Hands + Minimalismo Watchface — Design

**Date:** 2026-05-21
**Status:** Approved (design)

## Problem

The analog second hand has broken repeatedly:
1. **Backsweep** — a CSS `transition` interpolated the end-of-minute `354°→0°` the long way, sweeping the hand backward once a minute.
2. **Float32 jump** — a stateless `Math.floor(epoch/1000)*6` angle (~1e10°) lost ~150° in the compositor's float32 transform matrix, so the hand snapped to garbage.

Both grow from the **same fragile pattern**: a JS-computed angle driven into `transform: rotate()` with a CSS `transition`. `build` + `lint` passed both times; nothing verified the rendered result, so each regression shipped to the kiosks.

## Goal

A hand-rendering model where this class of bug is **structurally impossible**, plus a new minimal **Minimalismo** watchface (the smooth-sweeping face from slowclock) as the first consumer of smooth motion.

## Approach

Render hands **geometrically**: compute endpoint coordinates from the angle with `sin/cos` and set the SVG line's `x1,y1,x2,y2` directly. No `transform`, no `transition`, no accumulated angle. This is exactly how the native LVGL slow-clock renders — which is why that one has never had the bug. Motion is **per-face**: crisp tick by default, smooth sweep opt-in.

## Components

### 1. `handPoints()` — geometric primitive
New helper beside `useClockHands`:
```
handPoints(angleDeg, tipLen, tailLen, cx = 500, cy = 500): { x1, y1, x2, y2 }
  θ   = angleDeg * π/180          // 0° = 12 o'clock, increasing = clockwise
  tip : x2 = cx + tipLen*sinθ,  y2 = cy − tipLen*cosθ
  tail: x1 = cx − tailLen*sinθ, y1 = cy + tailLen*cosθ
```
Faces render `<line {...handPoints(deg, tip, tail)} stroke=… strokeWidth=… strokeLinecap="round" />` with **no transform/transition**. The angle only feeds trig (auto-reduced mod 2π); coordinates stay inside the 0–1000 viewBox. Backsweep and float32 are both impossible by construction.

### 2. `useClockHands(isActive, { sweep = false })`
- **tick** (default): `setInterval(1000)`; `secondDeg = seconds*6`.
- **sweep**: `requestAnimationFrame` loop throttled to ~30 fps (Pi-friendly); `secondDeg = (seconds + ms/1000)*6`; hour/minute glide too.
- Returns `{ time, hourDeg, minuteDeg, secondDeg }`. Angles are bounded 0–360 — no accumulation, no module anchor (the continuous-angle hack from the transition era is removed once all faces are geometric).

### 3. Migrate the 8 existing faces
Replace every hand's `style={{ transform: rotate(...) }}` (and the second hand's `transition`) with `{...handPoints(deg, tipLen, tailLen)}`, preserving all stroke/width/color/filter styling. Per-hand `tipLen`/`tailLen` are read off the current line geometry (e.g. AnalogClock second hand `y1=580,y2=150` → `tip 350, tail 80`). WorldClock's mini-dials already render geometrically. The `no-setInterval in src/apps/clock` ESLint guard stays.

### 4. New face: `MinimalismoClock`
`src/apps/clock/MinimalismoClock.tsx`, calling `useClockHands(isActive, { sweep: true })` and rendering with `handPoints`.
- Pure **white** full-screen face; **no** ticks, numerals, or center dot.
- Hour hand black, width 28, tip 280, tail 0.
- Minute hand black, width 20, tip 380, tail 0.
- Second hand gold `#FFD700`, width 6, tip 350, tail 80 — smooth sweep.

Registration:
- `ClockApp.tsx`: add to `FACE_COMPONENTS` as `minimalismo` and to `SWIPE_CYCLE_ORDER` **first** (per the documented spec).
- `face-registry.ts`: add a `FACES` entry (`id: 'minimalismo'`, `name: 'Minimalismo'`, `category: 'classic'`, `slots: []`, `configSchemaId: undefined`). Preview PNG captured from the rendered face via the browser preview and saved to `public/` (matching how the other real-render previews were made).

## Data flow
`new Date()` (1s interval or rAF) → `useClockHands` angles → `handPoints(angle, len, tail)` → SVG line coords. No transforms, no transitions, no stored angle.

## Verification (mandatory)
Before any deploy, load each affected face in the browser preview (port 5180) and confirm the hands sit at the correct position and the sweep face glides — the render-check that was skipped when float32 shipped. No automated test runner is added (chosen: bulletproof implementation over a test net).

## Out of scope
- Adding a test runner / automated tests.
- The other salvaged features (`salvage/settings-panel-*`).
- The native LVGL clock (already geometric; immune).

## Success criteria
- No `transform`/`transition` on any time-driven hand; no accumulated angle anywhere.
- All 8 existing faces verified correct in preview after migration.
- Minimalismo renders as spec'd (white, black hour/minute, gold smooth-sweeping second) and is swipe-cyclable.
- Deployed to fast/small/square, kiosks reloaded, visually confirmed on at least one device.
