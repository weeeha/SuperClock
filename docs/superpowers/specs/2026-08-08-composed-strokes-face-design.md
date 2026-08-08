# Composed Strokes face — design

**Date:** 2026-08-08
**Status:** Approved direction (Nick, this session): at-rest = perfectly still; layout = full field.
Remaining calls below were made autonomously under that direction.
**Source:** Board plate 17 ("Composed strokes", family COMPOSED FORM) on the
[fresh-thinking board](https://www.figma.com/board/JAjMCsw8hXx38locrxP5gd/SuperClock-fresh-thinking?node-id=22-647),
via `docs/superpowers/specs/2026-07-24-watchface-archetypes-study.md` (recommended fourth face).

## What it is

A field of small dials tiles the entire 1:1 disc. Each dial has two hands. In the centre,
a 4-column × 6-row block of dials composes four digits — HH stacked over MM — by aligning
hands into digit strokes. Every other hand in the field parks on a dim south-west diagonal.
Time is read by contrast: bright strokes against a ghost texture. No printed glyphs, no
ticks, no bezel — the lattice itself implies the circle.

## Decisions

| # | Decision | Choice | Why |
|---|---|---|---|
| 1 | At rest | **Perfectly still** (user-picked) | One-accent rule: the lit strokes are the accent; zero idle GPU on a for-weeks kiosk; friendliest to a future always-on variant |
| 2 | Layout | **Full field**, stacked HH/MM core (user-picked) | Honours the round canvas — no dead crescents; the parked field is the face's texture; the "personality" brief from the study |
| 3 | Choreography | **Same-direction clockwise sweep**, 2.4 s, ease-in-out, 45 ms reading-order stagger (≤ 500 ms total) | The signature of the archetype; monotonic rotation avoids jittery shortest-path reversals |
| 4 | Seconds / colon / date | **None** | Plate says 48 hands, 4 digits; minute resolution is the point (family precedent: Depletion and Daylight are also slow faces) |
| 5 | Stroke colour | `--color-accent` (#ff8826) | Matches the approved mockup; the composed time IS the face's one accent quantity |
| 6 | Config | `format: '24' \| '12'`, default `'24'` | Only knob that changes what the face says; 12 h renders a blank (parked) tens block for hours 1–9 |
| 7 | Naming | id `strokes`, display **"Composed Strokes"**, category `artistic`, preview `/strokes-thumb.svg` | Sibling convention: short id, two-word plate-derived name |

## Geometry (1000 × 1000 render space, sibling convention)

- **Lattice:** square packing, pitch `P = 110`, dial radius `R_d = 51`. A cell at integer
  coords `(c, r)` has centre `(500 + (c + 0.5)·P, 500 + (r + 0.5)·P)`. A cell exists iff
  `hypot(cx − 500, cy − 500) + R_d + 4 ≤ 496` → exactly 52 dials, symmetric by construction.
- **Core:** cols −2…1 × rows −3…2 (24 dials). Digit blocks (2×3 each): HH tens (−2,−3),
  HH ones (0,−3), MM tens (−2,0), MM ones (0,0). Digits are adjacent, no spacer — the
  ClockClock precedent; the font disambiguates.
- **Hands:** length `54` (= P/2 − 1, so within-digit strokes meet tip-to-tip at cell
  boundaries and read as continuous), width `13`, `stroke-linecap="round"`, drawn from dial
  centre. Parked = both hands co-located at **225°** (reads as one line; keeps parked ↔
  stroke transitions pure rotations of persistent elements — no swaps, no pops).
- **Dial plates:** `fill: var(--face-plate)`, no ring stroke. Background `--face-bg`.
  No outer bezel circle — deliberate departure from siblings.

## Digit font

Angles in degrees, 0 = north, clockwise; each cell = `[a, b]` (two hands) or `null`
(parked). Cell order per digit block: TL TR / ML MR / BL BR.

```
0: [ 90,180] [270,180] [  0,180] [  0,180] [  0, 90] [  0,270]
1:   null    [180,180]   null    [  0,180]   null    [  0,  0]
2: [ 90, 90] [270,180] [ 90,180] [  0,270] [  0, 90] [270,270]
3: [ 90, 90] [270,180] [ 90, 90] [  0,180] [ 90, 90] [  0,270]
4: [180,180] [180,180] [  0, 90] [  0,180]   null    [  0,  0]
5: [ 90,180] [270,270] [  0, 90] [270,180] [ 90, 90] [  0,270]
6: [ 90,180] [270,270] [  0,180] [270,180] [  0, 90] [  0,270]
7: [ 90, 90] [270,180]   null    [  0,180]   null    [  0,  0]
8: [ 90,180] [270,180] [  0, 90] [  0,270] [  0, 90] [  0,270]
9: [ 90,180] [270,180] [  0, 90] [  0,180] [ 90, 90] [  0,270]
```

**Junction convention:** with two hands per cell a T-junction cannot be drawn; digits
3/4/6/8/9 carry a deliberate half-cell gap at one junction (e.g. 8's lower ring floats off
the waist bar). This is inherent to the 6-cell hand font — ClockClock has the same
property — and is the font's character, not a bug. The geometry test asserts the
*required* tip-to-tip continuities per digit, not the impossible ones.

**12 h mode:** hours 1–9 park the entire tens block (no leading zero). `0x` minutes keep
their zero.

## Motion

- A hand's rendered angle is **cumulative**: `next = prev + ((target − prev) mod 360)`,
  normalised to (0, 360] — every move is clockwise, including parked ↔ stroke.
- On a minute step of exactly +1 while mounted and active: hands whose target changed
  transition `transform 2.4s cubic-bezier(0.4, 0, 0.2, 1)` with `delay = 45 ms × reading
  order` within the changed set (row-major), capped at 500 ms. Typically 12 hands move
  (ones-of-minutes); 48 at ten-minute/hour boundaries; the field never moves after first
  composition.
- Any other time delta (mount, reactivation after grid overlay, resume, clock jump):
  **snap**, no transition. First paint is always a snap.
- Implementation: each hand is `<g transform="translate(cx cy)"><g style="transform:
  rotate(Ndeg); transition: …">` — rotation about the dial centre, compositor-friendly,
  no per-frame JS. At rest zero timers beyond `useClockHands(isActive)`'s own tick, and
  the render memoises on `minuteOfDay` (Depletion precedent).

## Tokens

One new pair in `src/index.css` (fourth `--face-*` addition, three-faces precedent):

```
--face-ghost: #d9d9d4   /* light — parked hands on #f1f1ef plates */
--face-ghost: #2c2f35   /* dark  — parked hands on #15171a plates */
```

`--face-spent` is wrong for this (near-invisible on-plate in dark mode; the approved
mockup shows a clearly present ghost field). Night mode: global CSS dimming applies as-is;
always-on/OPR variant stays deferred exactly like the siblings.

## Wiring (registry-coherence will enforce)

1. `src/apps/clock/strokes-geometry.ts` — pure: lattice builder, digit font table,
   `composeTargets(time, format)` → per-cell hand angles, `advanceClockwise(prev, target)`.
2. `src/apps/clock/StrokesClock.tsx` — default export, `FaceProps`, safeParse of
   `face.strokes` config with defaults fallback (Depletion pattern).
3. `src/apps/clock/face-components.ts` — import; `FACE_COMPONENTS.strokes`; append to
   `SWIPE_CYCLE_ORDER`.
4. `src/shared/face-registry.ts` — descriptor `{ id: 'strokes', name: 'Composed Strokes',
   preview: '/strokes-thumb.svg', category: 'artistic', configSchemaId: 'face.strokes',
   slots: [] }`.
5. `src/shared/schemas/face.strokes.ts` + entry in `src/shared/schema-registry.ts`.
6. `public/strokes-thumb.svg` — static mini-render (SVG thumb, three-faces precedent).

## Testing (`strokes-geometry.test.ts`)

- Lattice: every cell fully inside the disc; 4-fold symmetry; core cells all present.
- Font: all ten digits defined, 6 cells each; required stroke continuities hold
  (declared adjacency list per digit); parked cells are `null`.
- `composeTargets`: 24 h `05:07` → correct blocks; 12 h `17:05` → hours "5" with blank
  tens block; midnight `00:00` in both formats.
- `advanceClockwise`: never decreases; `(350 → 10)` travels +20; `(10 → 10)` travels 0.

## Out of scope

- LVGL port for `slow` — capped by ADR D3 (no new hand-synced faces before the JSON face
  spec). React-only, like Depletion/Aperture/Daylight.
- Always-on/OPR night variant; complication slots; seconds; any second accent quantity.
