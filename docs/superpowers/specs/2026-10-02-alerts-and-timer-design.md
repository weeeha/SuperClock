# Background alerts + Timer — design

**Date:** 2026-10-02
**Status:** Approved in sections (Nick, this session). Sub-project 2 of 4 in the missing-apps
round (Countdown → **alerts + Timer** → Alarm → admin-editable content + Notes).
**Source:** board section **Timer** `51:863` on the Designs page of the
[fresh-thinking board](https://www.figma.com/board/JAjMCsw8hXx38locrxP5gd?node-id=51-863)
(frames 0 to 2 by Nick; frames 3 "Paused" and 4 "Done · after 5 min" and the dated update note
added this session), admin wireframe D17 (`122:937`), and the Alarm section `111:957`, whose
note already asks for "an overlay above playlist + idle-return".

## What it is

Two things that ship together:

1. **A core alert layer.** Anything can schedule an alert for a moment in the future. When the
   moment comes, the alert takes over the screen above every app, the grid and the settings
   sheet, pauses playlist rotation and idle-return, optionally chimes, and stays until it is
   dismissed. It survives app unmounts, Chromium restarts and deploys. Timer is its first user;
   Alarm (sub-project 3) is the second.
2. **The Timer app.** Set a duration, start it, swipe away; when it runs out the screen says so
   from wherever you are.

`time-tracking`, today registered as "Timer", is renamed **"Focus"** so the new app can take
the plain name.

## Decisions

| # | Decision | Choice | Why |
|---|---|---|---|
| 1 | Where Done appears | **A core overlay layer** above everything (Nick, approach A) | Captures all input without fighting the swipe grammar or the nav store's transition traps; works over the grid and settings; Alarm's board note specifies it |
| 2 | Ring duration | **5 minutes, then settle** into a still "Done at 12:41" (Nick) | Bounds full-screen flashing, chime, heat and panel wear in an empty room |
| 3 | Name clash | **time-tracking becomes "Focus"**; the new app is "Timer" (Nick) | It is a pomodoro focus timer by its own description; id and config unchanged |
| 4 | Timers per clock | **One** | The board draws one; YAGNI |
| 5 | Survives restart | **Yes**: alert and timer state persist in localStorage | Chromium restarts every 6 hours and on every deploy |
| 6 | Set-time drag | **Inside the arc ring**: claims the pointer only from 60% of the radius to the inner edge of the arc ring | The outer 70 px are the arc-zone grammar since nav v2; same rule as Alarm's ring dial; supersedes the board note's "outer ring" |
| 7 | Timer ring radius | **380 units** (stroke 26), not Countdown's 447 | The visible ring must lie inside the claim band (300 to 435 units), or touching it would start an arc gesture |
| 8 | Brightness at night | **Respect night dimming** | A timer is not a wake-up; brightness override arrives with Alarm |
| 9 | Panel switched off by the server | **Out of scope** | The kiosk has no wake request today; Alarm adds it. Fastclock's chime still sounds with the panel off |
| 10 | Sound | **Only on clocks with the `audio` flag, and only when the alert asks for it** | Fastclock's Fusion HAT; never fake an audio state elsewhere |

## The alert layer (`src/core/alerts/`)

### Data and store — `alert-store.ts`

```ts
export interface ScheduledAlert {
  id: string;                         // unique per alert; Timer uses 'timer'
  appId: string;                      // whose registered view renders it
  firesAt: number;                    // epoch ms
  sound: boolean;                     // chime requested (still gated by the device flag)
  payload: Record<string, unknown>;   // app-specific, e.g. { durationMs }
}
export interface RingingAlert extends ScheduledAlert {
  firedAt: number;                    // epoch ms
  settled: boolean;                   // flipped by the scheduler RING_MS after firedAt
}
interface AlertState {
  scheduled: ScheduledAlert[];
  ringing: RingingAlert | null;
  schedule(alert: ScheduledAlert): void; // replaces an alert with the same id
  cancel(id: string): void;              // removes from scheduled; no-op if absent
  fire(id: string, firedAt: number): void; // moves scheduled → ringing (settled: false)
  settle(): void;                        // marks the ringing alert settled
  dismiss(): void;                       // clears ringing; counts as a user gesture
}
export const RING_MS = 5 * 60_000;
export function ringPhase(alert: RingingAlert): 'ringing' | 'settled'; // reads `settled`
```

- A zustand store persisted to localStorage key `superclock:alerts:v1`, validated with zod on
  load. Anything that fails validation loads as `{ scheduled: [], ringing: null }`: losing an
  alert is better than a crashed kiosk. Storage is injected so the store runs under test
  without a DOM (the `local-overrides.ts` pattern).
- One alert rings at a time. If a second fires while one is ringing, it waits in `scheduled`
  and fires as soon as the first is dismissed (with its true `firedAt`, so its 5 minutes are
  not reset).
- `dismiss()` calls `useNavigation.getState().noteUserGesture()`, so playlist rotation resumes
  after its normal 30-second cooldown.
- `ringPhase` reads the `settled` flag. The scheduler sets it once `RING_MS` has passed since
  `firedAt` (amended while planning: one clock owns every boundary).

### Scheduler — `useAlertScheduler()`

Mounted once in `App.tsx`. It keeps exactly one `setTimeout`, aimed at the next boundary:
the ringing alert's settle time while one rings, otherwise the earliest `firesAt` (clamped to
2^31 − 1 ms), re-armed whenever `scheduled` changes, on
`visibilitychange`, and after every fire. On load, any alert whose `firesAt` is already past
fires immediately with `firedAt = firesAt`, so a timer that ran out during a Chromium restart
rings for what is left of its 5 minutes, or shows settled.

This is the board's one deliberate exception to "only tick while active": a background alert
that dies with its app is useless. It is a single timeout, it lives in `src/core` (outside
`KIO-1`'s `src/apps` scope), and nothing re-renders between alerts.

### The layer — `AlertLayer.tsx` and `registerAlertView`

```ts
export interface AlertViewProps {
  alert: RingingAlert;
  phase: 'ringing' | 'settled';
  dismiss: () => void;
}
export function registerAlertView(appId: string, view: React.ComponentType<AlertViewProps>): void;
```

- Apps register their view from their `index.ts` (Timer registers a `lazy` view).
- `AlertLayer` is mounted last in `App.tsx`, after `PresenceShade`, `fixed inset-0 z-[9500]`:
  above the `z-[9000]` fade overlay and every app layer, below only the dev-only `z-[9999]`
  gesture-debug badge. With nothing ringing it renders nothing. While an alert rings it
  renders that app's view inside `Suspense`; an alert whose app registered no view renders a
  plain fallback ("Alert", tap to dismiss) rather than nothing, so it can always be cleared.
- It holds no timer of its own: the scheduler settles the alert and the layer re-renders from
  the store.

### Changes to existing code

- `src/core/hooks/useGestures.ts`: while `ringing` is set, drag and pinch handlers return
  early (the overlay's own taps still work). Drags whose start target is inside an element
  marked `data-gesture="claim"` are also ignored for the whole gesture (decided in
  `onDragStart`, consumed in `onDrag`/`onDragEnd`). The three-finger panic stays unconditional.
- `src/core/playlist.ts`: `usePlaylistAutoRotate` does not advance while an alert rings.
- `src/core/hooks/useIdleReturn.ts`: `checkIdle` returns early while an alert rings.
- `src/core/components/PresenceShade.tsx`: renders nothing while an alert rings.

### Chime — `chime.ts`

A two-tone chime (880 Hz then 1320 Hz, 180 ms each) synthesised with Web Audio, as Fitness
does, so there is no asset to ship. It repeats every 2 s during `'ringing'` only, and plays
only when `alert.sound` is true **and**
`STATIC_DEVICE_INFO[config.deviceId].features.includes('audio')`. Chromium already runs with
`--autoplay-policy=no-user-gesture-required`. The `AudioContext` is created on first use and
closed when the alert stops ringing.

## The Timer app (`src/apps/timer/`)

### State — `timer-store.ts`

```ts
type TimerState =
  | { status: 'idle'; durationMs: number }
  | { status: 'running'; durationMs: number; endsAt: number }
  | { status: 'paused'; durationMs: number; remainingMs: number };
```

Module scope (the app unmounts on swipe-away), persisted to `superclock:app:timer:v1` with the
same zod-guarded load. Actions:

- `setDuration(ms)` (idle only; clamped to 30 s … 60 min, snapped to 30 s).
- `start(sound)`: `endsAt = now + durationMs`, schedules alert
  `{ id: 'timer', appId: 'timer', firesAt: endsAt, sound, payload: { durationMs } }`.
- `pause()`: cancels the alert, keeps `remainingMs`.
- `resume(sound)`: `endsAt = now + remainingMs`, schedules a fresh alert.
- `reset()`: cancels the alert, back to idle with the same `durationMs`.
- `finish()`: back to idle with the same `durationMs` (called by the alert view on dismiss).

The first-ever duration is the first preset; after that the last one used.

**Reconcile.** On hydration and whenever the app renders, a `running` timer whose `endsAt` has
passed and whose `'timer'` alert is neither scheduled nor ringing returns to idle. That covers
an alert cleared through the layer's fallback view, which never calls `finish()`.

### Screens

All on the face palette (`--face-bg`, `--face-ink`, `--face-ink-muted`, `--face-ghost`,
`--color-accent`) with Quote's `theme-fade`, using only sizes the ratchet already counts:
readout `text-[17vmin]` (`tabular-nums`), labels `text-[2.6vmin]`, captions `text-[2.2vmin]`.

| # | Screen | Content | Input |
|---|---|---|---|
| 0 | **Set time** | "Set timer" caption above; readout `MM:SS`; up to 4 preset chips below ("5 min"; selected chip filled `--face-ink` with `--face-bg` text, others a `--face-ghost` hairline); a `--face-ghost` ring at r 380 with a `--face-ink` arc for the set duration | Drag in the dial band sets the duration; tap a chip; tap the readout to start |
| 1 | **Running** | Ring at r 380: track `--face-ghost`, remaining arc `--color-accent` draining clockwise from 12, stepped each second with a 1 s linear `stroke-dashoffset` transition; readout; caption "of 5:00" | Tap: pause. Long-press 600 ms: reset |
| 2 | **Done · ringing** (alert view) | "00:00" and "Time's up" (board frame 2). The whole view alternates between the face palette and its inverse once a second (`alert-pulse`, 0.5 s each half). Under `prefers-reduced-motion` it holds the inverse without pulsing | Tap anywhere: dismiss |
| 3 | **Paused** | Ring and readout in `--face-ink-muted`; caption "Paused" | Tap: resume. Long-press: reset |
| 4 | **Done · settled** (alert view, after 5 min) | Still, muted: "Done at" / local `HH:MM` of `firedAt` / "Tap to clear" | Tap anywhere: dismiss |

**Dial.** The claim band is every touch that starts between `0.6 × R` and the arc ring's inner
edge (`R × (1 − RING_FRACTION)`, from `gesture-zones.ts`), where `R` is half the shorter
viewport side: 300 to 435 units. The band is one element carrying `data-gesture="claim"`. While
dragging, the angle is tracked cumulatively from the drag start so crossing 12 never jumps;
one revolution is 60 minutes; the result is snapped to 30 s and clamped to 0:30 … 60:00.
Drags starting nearer the centre fall through to the global swipe; the outer arcs keep their
grammar.

**The pulse.** A keyframe class `.alert-pulse` in `src/index.css` beside `.dissolve-in`, with a
`prefers-reduced-motion: reduce` guard. It is not an `animate-` utility, so `MOT-1`'s heuristic
does not see it; it meets that rule's intent because it loops only while an alert is really
ringing, and stops at the 5-minute settle. One flash per second is under the 3-per-second
photosensitivity threshold.

**Ticks.** The per-second readout tick is a `setInterval` gated on `isActive`, so the
capability row is `timer: ['ticks']`. Nothing ticks while the app is inactive; the alert does
not depend on it.

### Config — `src/shared/schemas/app.timer.ts`

```ts
export const TIMER_PRESET_MINUTES = ['1', '2', '3', '5', '10', '15', '20', '25', '30', '45', '60'] as const;
export const timerAppSchema = z.object({
  presets: z.array(z.enum(TIMER_PRESET_MINUTES)).max(4).default(['1', '3', '5', '10']),
  sound: z.boolean().default(true),
});
```

`presets` renders as the admin's existing ordered multi-select (it has no number-list editor);
order in the admin is order on glass. `sound` meta: "Plays on clocks with a speaker (Fast).
Others pulse silently." Simpler than D17: no "default minutes" or "custom" row, because the
clock remembers the last duration.

## The rename

`src/apps/time-tracking/index.ts` registers `name: 'Focus'`; `src/admin/lib/app-names.ts`
follows (`registry-contract.test.ts` pins the copy); the README line for `time-tracking`
keeps its description. Id, schema and stored config are untouched.

## Wiring

`npm run new:app -- timer`, then by hand: the `timer: ['ticks']` capability row,
`public/timer-thumb.svg` (dark disc, the todo/countdown thumb construction) plus its
`AppGrid.tsx` tile, `APP_ICONS` and admin name (alphabetical), README / `directive/foundation.md`
/ `docs/architecture.md` to 16 apps (`docs-drift.test.ts`), `npm run snapshot:schemas`,
`npm run report`, `npm run analyze -- --write`. Touching `useGestures.ts` loads
`.claude/rules/gestures-and-navigation.md`; the claim attribute adds no nav-store slot.

## Testing

- `alert-store.test.ts`: schedule, replace by id, cancel, fire, dismiss (and that it notes a
  gesture); a second alert waits while one rings and then fires with its true `firedAt`;
  persistence round trip; corrupt and wrong-shape storage load empty; `ringPhase` at 0, 4:59
  and 5:00.
- `scheduler.test.ts` (fake timers): one timeout to the earliest alert; re-armed after cancel
  and after fire; a past-due alert fires on load with `firedAt = firesAt`; re-check on
  `visibilitychange`.
- `AlertLayer.test.tsx`: renders nothing when idle; renders the registered view when ringing;
  the fallback view for an unregistered app dismisses on tap; re-renders at the settle
  boundary.
- Integration: while ringing, `checkIdle` does nothing, the playlist does not advance,
  `PresenceShade` renders nothing, and the gesture handlers ignore a drag; a drag starting in
  a `data-gesture="claim"` element does not switch apps.
- `chime.test.ts` (mocked `AudioContext`): plays with `audio` + `sound`; silent without either;
  stops on settle and on dismiss.
- `timer-store.test.ts`: start / pause / resume / reset / finish; the alert it schedules and
  cancels; clamping and snapping; rehydration after reload; reconcile of a past-due running
  timer with no alert.
- `dial.test.ts`: band classification at the edges; cumulative angle across 12; 30 s snap;
  clamps.
- `TimerApp.test.tsx`: each screen from store state; tap and long-press; no interval while
  inactive.
- Gates: `./scripts/gates.sh` green; font-size and colour ratchets do not grow;
  `check:rules` clean on new files.
- Rendered: all five screens at 1080 × 1080 in both palettes; in the browser, a drag that
  starts in the band changes the duration and does not switch apps, and a swipe starting near
  the centre still does.

## Needs Nick

Seeing Timer on the round panel and hearing fastclock's chime both need a Timer screen added in
the admin (fastclock's device config is token-gated) and a real touch. Once a timer is ringing
on fastclock, the controller can confirm remotely that Chromium's audio stream is running
(`/proc/asound/card*/pcm*p/sub*/status` reads `RUNNING`).

## Out of scope

- Waking a panel the server switched off (sleep schedule or presence) — sub-project 3.
- Overriding night brightness; snooze; repeating alerts — sub-project 3.
- More than one timer; timers longer than 60 minutes.
- slowclock (LVGL).
