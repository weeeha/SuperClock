# Three faces — Depletion, Aperture, Daylight — design

**Date:** 2026-07-24
**Status:** Approved direction (sections 1–2 reviewed interactively; 3–4 by delegated
recommendation). Implementation follows in the same branch.
**Scope:** Three new watch faces plus three shared CSS tokens. React only — no LVGL port
(the `slow` device's display is still TBD in `superclock-slow/device.json`); the token
set is designed to be portable and parity is filed as follow-up work.
**Preceded by:** [the archetype study](2026-07-24-watchface-archetypes-study.md) (PR #32),
which chose these three structures from eight encoding families.

## Why these three

All nine shipped faces encode time as angle. These three add two new encoding families
(length & area, aperture) chosen for the one property that matters on a wall clock: they
stay legible at three metres, where subdial layouts fail. Depletion and Daylight need no
data beyond the system clock (Daylight computes sunrise/sunset locally); Aperture is the
most distance-legible structure in the study.

## Build approach (decided)

**Approach A — three components plus a minimal shared surface.** Each face is a
`src/apps/clock/<Name>Clock.tsx` wired into the existing four registries. Shared code is
only what has three consumers or is pure maths:

- three CSS tokens in `src/index.css` (below)
- `src/apps/clock/day-fraction.ts` — pure local-day arithmetic (DST-safe)
- `src/apps/clock/solar.ts` — pure NOAA sunrise/sunset

Explicitly rejected: a speculative face-kit component library (three samples is too few
to design its API), and the data-driven face spec (right long-term destination, but a
platform project that would ship zero faces now).

## Section 1 — the shared system

### Tokens

The faces consume the existing contract from `src/index.css` (`--face-bg`, `--face-ink`,
`--face-ink-muted`, `--face-tick`, flipped by `html.dark`) plus the per-device
`--color-accent` (`settings.accent`, default `#ff8826`). Three tokens are added, each
because one face needs a surface the current set cannot express:

| Token | Day | Night | For |
|---|---|---|---|
| `--face-plate` | `#F1F1EF` | `#15171A` | Aperture — plate one step off the ground so windows read as cut |
| `--face-dusk` | `#8FA9C4` | `#2B3D52` | Daylight — the night arc, a colour opposite the accent, not a dimmer ink |
| `--face-spent` | `#E4E4E1` | `#111316` | Depletion — elapsed time, present but silent |

### The accent rule

**One live quantity per face carries the accent; everything else is ink, muted or
tick.** Depletion: the remaining wedge. Daylight: the sunlit arc. Aperture: the
seconds-progress bar under the minute window. This is the constraint that makes three
structurally unrelated dials read as one family, and it holds for any configured accent.

### Scales

One number drives both scales: at 3 m on a 127 mm dial a glyph needs ~120 px cap height
= 111 units in the 1000-unit viewBox all faces draw in.

- **Stroke:** 3 (hairline) · 6 (tick) · 11 (tick major) · 17 (hand) · 26 (heavy). No others.
- **Type:** 260 (display) and 40 (label), Inter. Labels sit below the 3 m floor by
  design — walk-closer information.
- **Margins:** dial edge at r=470 (0.94R), tick ring at 455 (0.91R) — Pebble's round
  guidance: no thin rings against a bezel whose mounting tolerance shows.

### Night

Faces are token-driven, so `html.dark` restyles them with no face-specific night code;
the `.theme-fade` class gives the existing 1 s crossfade. The `brightness()` filter from
`apply-settings.ts` applies on top. Depletion is naturally darkest late in the day
(accent area → 0), which incidentally satisfies the 15% lit-pixel always-on budget the
platform research surfaced.

## Section 2 — Depletion disc (`depletion`)

A 24-hour dial, **midnight at top**, one revolution per calendar day. No hands: a fixed
hairline at 12 (the midnight datum), a heavy boundary line at now, an accent wedge
spanning now→midnight (the time remaining), `--face-spent` filling the rest. Optional
muted readout ("6H 12M LEFT") inside the spent area at y=700.

- **Midnight snaps** — sliver to full disc in one frame. No refill animation.
- **Update path:** `useClockHands(isActive)` ticks per second; geometry is memoised on
  `minuteOfDay`, so one DOM write per minute. (ESLint bans a second interval in
  `src/apps/clock`; memoisation gets the same result without one.)
- **DST:** fractions computed from real local-midnight boundaries
  (`day-fraction.ts`), not a fixed 1440 — 23- and 25-hour days reach empty exactly at
  local midnight.

### Config (`face.depletion`)

| Field | Values | Default |
|---|---|---|
| `cycle` | `calendar-day` \| `awake` | `calendar-day` |
| `ticks` | `hours` \| `quarters` \| `none` | `hours` |
| `readout` | `remaining` \| `none` | `remaining` |

`awake` reuses the device's existing `settings.night` window via the already-tested
`isWithinWindow` — no new fields. Inside the window: fully spent disc, readout counts
down to the window opening. No window configured → falls back to `calendar-day`.

## Section 3 — Aperture plate (`aperture`)

No hands. A `--face-plate` disc covers the dial; two windows are cut into it
(hour above centre, minute below), showing digits that **step** — the hour on the hour,
the minute on the minute. Nothing sweeps. Digits at 280 units, `--face-ink`, tabular.
Window frames are hairline ink; the windows themselves are `--face-bg` so they read as
holes through to the ground.

- **Accent quantity:** a seconds-progress bar along the bottom edge of the minute
  window — width grows 0→window-width across the minute, resets on the step. It is the
  only motion on the face and the only accent.
- Optional date line ("THU 24 JUL", 40 muted) under the minute window.
- Update path: per-second render from `useClockHands` is already needed for the seconds
  bar; hour/minute text nodes only change when their values do (React diffs identical
  strings to nothing).

### Config (`face.aperture`)

| Field | Values | Default |
|---|---|---|
| `format` | `24h` \| `12h` | `24h` |
| `showDate` | boolean | `true` |
| `secondsBar` | boolean | `true` |

`12h` shows a small AM/PM tag (40 muted) beside the hour window. `secondsBar: false`
makes the face fully static between minute steps — the lowest-power face in the fleet.

## Section 4 — Daylight band (`daylight`)

A 24-hour dial, **noon at top** (the solar convention: hand high = sun high; the two
24-hour faces deliberately differ in orientation — Depletion's datum is midnight, this
face's datum is the sky. This supersedes Section 1's passing "shared mental model"
remark). One `--face-ink` hand revolves once per day; a small disc at its tip is the
sun. The 24-hour ring is an annulus at r=400: the sunrise→sunset arc in accent, the
rest in `--face-dusk`. Arc length is the season; hand-inside-arc is daytime.

- **Solar maths on-device** (`solar.ts`, NOAA equations): pure
  `sunTimes(date, lat, lon)` → local sunrise/sunset minutes, or `'polar-day'` /
  `'polar-night'`, rendered as a fully-accent or fully-dusk ring. No network, no
  offline state, deterministic and unit-testable.
- Optional sunrise/sunset time labels (40 muted) at the band ends.
- Update path: memoised on `minuteOfDay` like Depletion; sun times recomputed once per
  day (memoised on the date string).

### Config (`face.daylight`)

| Field | Values | Default |
|---|---|---|
| `latitude` | number, −90…90 | `0` |
| `longitude` | number, −180…180 | `0` |
| `showTimes` | boolean | `true` |

Defaults (0, 0) yield ~06:00/18:00 year-round — a sane neutral rather than an invented
home location. Coordinates are face config on purpose: the weather app's env-var path
(`VITE_WEATHER_LAT/LON`) is known-broken (admin config ignored; separate fix spawned)
and nothing new should depend on it.

## Registry wiring (all three)

Per face: component in `FACE_COMPONENTS` + `SWIPE_CYCLE_ORDER`
(`face-components.ts`), descriptor in `face-registry.ts`, `face.<id>` schema in
`src/shared/schemas/` registered in `schema-registry.ts`. `registry-coherence.test.ts`
pins all four. Previews are hand-drawn SVG thumbs in `public/`
(`/depletion-thumb.svg` etc.) — precedent: `/minimalismo-thumb.svg`. Categories:
`depletion` and `aperture` → `modern`, `daylight` → `utility` (the five categories are
our own invention; renaming them is out of scope).

Faces ship inside the clock app, so `ALL_KIOSK_APP_IDS` and capabilities are untouched.

## Tests

- `day-fraction.test.ts`: 00:00 → full remaining (not zero); 23:59 → 1 min sliver;
  DST spring-forward and autumn-back days reach empty at local midnight; `awake` inside
  window → spent + countdown; `awake` with no window → calendar-day fallback.
- `solar.test.ts`: known city/date pairs within ±5 min (Berlin & Sydney, solstices);
  equator default ≈ 06:00/18:00; polar day and night at 78°N.
- `registry-coherence.test.ts` passes unmodified — it is the wiring checklist.

## Out of scope (follow-ups)

- LVGL ports for the `slow` device (blocked on hardware TBD).
- A real always-on/OPR night variant (separate investigation; CSS dimming today).
- Face category taxonomy rename.
- Weather app config fix (spawned as its own task).
