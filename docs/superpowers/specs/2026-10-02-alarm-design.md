# Alarm — design

**Date:** 2026-10-02
**Status:** Approved in sections (Nick, this session). Sub-project 3 of 4 in the missing-apps round
(Countdown → alerts + Timer → **Alarm** → admin-editable content + Notes). Builds on the core
alert layer from sub-project 2 (`docs/superpowers/specs/2026-10-02-alerts-and-timer-design.md`).
**Source:** board section **Alarm** `111:957` on the Designs page of the
[fresh-thinking board](https://www.figma.com/board/JAjMCsw8hXx38locrxP5gd?node-id=111-957)
(frames 1 to 6 by Nick; frames 7 "No alarms" and 8 "Missed" and the dated update note added this
session), admin wireframe D19 (`122:1019`).

## What it is

A bedside-style alarm clock on the kiosk. Alarms repeat on chosen weekdays or fire once. Before an
alarm, the panel wakes and the night dimming fades out (gentle wake). At the alarm time the core
alert layer takes over the screen at full brightness: tap to snooze, hold to stop. Fastclock
chimes; the other clocks flash and say they have no speaker. Alarms are set on the glass in this
sub-project; editing them from the admin arrives with sub-project 4's content sync.

The core layer gains five small, generic additions that Alarm needs and Timer benefits from: a
per-alert ring length, an opt-in brightness hold, waking a panel the server switched off, a lead
window before an alert, and a brightness ramp during that window.

## Decisions

| # | Decision | Choice | Why |
|---|---|---|---|
| 1 | Unattended ringing | **15 minutes, then settle** as "Missed · 07:10" (Nick) | Bounded; the next occurrence is already scheduled |
| 2 | Waking a switched-off panel | **A loopback-only wake request** from the kiosk to its own server (Nick, approach A) | Generic, tiny, and covers Timer too; the server never learns what an alarm is |
| 3 | Where alarms are edited | **On the glass only**, for now | Admin CRUD needs sub-project 4's content sync, per the approved order |
| 4 | Repeat model | `days: number[]` (0 Sunday … 6 Saturday); empty = **once**, which turns itself off after firing | Board note 2 |
| 5 | Ringing input | **Tap: snooze. Hold 2 s: stop**, with a progress arc while held | Board note 5: snooze easy, stop deliberate |
| 6 | Night brightness | **Full brightness while an alarm rings** (brightness lease); a timer at night stays dimmed | An alarm is a wake-up; a timer is not |
| 7 | Gentle wake | **A CSS transition** clears the night filter over the lead time | No JavaScript ticks; the browser animates the whole ramp |
| 8 | Sound | **One sound**, the existing chime, only with the `audio` flag | Volume and sound choice (D19's "chime ▾") are out of scope |
| 9 | Ring dial | **Inside the claim band**, 5-minute steps, tap the readout to switch to hours | Same arc-zone rule as Timer (board note 3) |

## Core and server changes

### 1. Ring length per alert

`ScheduledAlert` gains `ringMs?: number`. The scheduler's settle boundary becomes
`firedAt + (alert.ringMs ?? RING_MS)`. The field is optional in the zod schema, so alerts stored
under `superclock:alerts:v1` by sub-project 2 still load.

### 2. Brightness hold, opt-in

`ScheduledAlert` gains `bright?: boolean`. While a `bright` alert rings (not settled),
`AlertLayer` calls `acquireBrightnessLease()` at once and every 60 s (the lease lasts 90 s), and
`releaseBrightnessLease()` when it settles or is dismissed. The lease already makes
`apply-settings` render unfiltered.

### 3. Waking a switched-off panel

- **Kiosk:** `src/core/alerts/wake.ts` exports `requestPanelWake(untilMs: number): void`, a
  fire-and-forget `fetch('/api/device/wake', { method: 'POST', body: { untilMs } })` that swallows
  every failure (the alert must ring whether or not the panel can be woken). `AlertLayer` calls it
  once when an alert starts ringing, with `untilMs = firedAt + ringMs + 60_000`.
- **Server:** `POST /api/device/wake` in `server/device-routes.ts`. It answers 403 unless
  `req.socket.remoteAddress` is loopback (`127.0.0.1`, `::1`, `::ffff:127.0.0.1`); validates
  `{ untilMs: number }` with zod (400 otherwise); clamps to at most `now + 30 min`; calls
  `wakePanelUntil(untilMs)` and returns `{ wakeUntil }`. It is not behind the admin token: the
  kiosk has no token, and loopback-only is the guard.
- **Display adapter:** a module `wakeUntil = 0`; exported `wakePanelUntil(ms)` sets
  `wakeUntil = Math.max(wakeUntil, ms)` and calls `reconcile(latestConfig)` at once. `decidePower`
  gains a first rule, `if (now.getTime() < wakeUntil) return true`, and is exported for tests.
  After the wake expires, the existing 30 s tick returns the panel to its schedule. Off a Pi it
  still no-ops.

### 4. Lead window

`ScheduledAlert` gains `leadMs?: number`. The store gains `leading: string | null` (the id of a
scheduled alert inside its lead window) and a `setLeading(id | null)` action. `planNext` treats
`firesAt − leadMs` as one more boundary: when it has passed for the earliest such alert and
`leading` is not already that id, it returns `{ kind: 'lead', alert }` and the scheduler calls
`setLeading(alert.id)`. Firing or cancelling that alert clears `leading`. `leading` is persisted
with the rest of the store.

### 5. Brightness ramp

While `leading` is set, `AlertLayer` calls `requestPanelWake(firesAt + ringMs + 60_000)` once, and
`apply-settings` ramps: instead of its usual `filter 1s ease`, it sets
`transition: filter <firesAt − now>ms linear` and clears the filter, so the browser fades the
night dimming out by the alarm time. A pure helper `rampTransition(firesAt, now): string`
computes the value. A cancelled lead restores the normal pipeline on the next render.

## The Alarm app (`src/apps/alarm/`)

### State — `alarm-store.ts`

```ts
export interface Alarm { id: string; time: string; days: number[]; enabled: boolean }  // time 'HH:MM'
```

Module scope, persisted to `superclock:app:alarm:v1`, zod-guarded (corrupt → no alarms).
Actions: `add(time, days)` (enabled, new id), `update(id, patch)`, `toggle(id)`, `remove(id)`.

### Scheduling — `alarm-schedule.ts` and one boot subscription

- `nextOccurrence(alarm, now: Date): number | null` — the next local `Date(y, m, d, hh, mm)` on an
  allowed day strictly after `now` (once: today if still ahead, else tomorrow); `null` when
  disabled. Built from date fields, so DST is handled by the Date constructor (a 02:30 alarm on a
  spring-forward night rings at 03:30).
- `syncAlarmAlerts(alarms, alerts, settings, now)` — for every enabled alarm, schedule core alert
  `alarm:<id>` at its next occurrence with `appId: 'alarm'`, `sound: settings.sound`,
  `bright: true`, `ringMs: 15 * 60_000`, `leadMs: settings.gentleWakeMinutes * 60_000` (omitted
  at 0), `payload: { alarmId, time }`; cancel `alarm:<id>` for disabled or deleted alarms.
  Idempotent (schedule replaces by id). It never touches `alarm:<id>:snooze`, except that deleting
  or disabling an alarm also cancels its pending snooze.
- `startAlarmSync()` is called once from `src/apps/alarm/index.ts` (side-imported at boot). It
  subscribes to the alarm store and the device config (the settings come from the first `alarm`
  screen instance's config, else schema defaults) and re-syncs on change; and it subscribes to the
  alert store so that when `alarm:<id>` starts ringing it immediately schedules that alarm's next
  occurrence and turns a once-alarm off. Subscriptions only: no timers.
- **Snooze:** the ringing view dismisses and schedules `alarm:<id>:snooze` at
  `now + snoozeMinutes`, same shape, no `leadMs`.

### Screens

Face palette, Quote's `theme-fade`, the three ratchet sizes (`text-[17vmin]`, `text-[2.6vmin]`,
`text-[2.2vmin]`), as Countdown and Timer.

| # | Screen | Content | Input |
|---|---|---|---|
| 1 | **Resting** | Next alarm `HH:MM`; "in 8h 32m" (updates each minute while active); its days ("Weekdays", "Every day", "Mon, Wed", "Once") | Swipe ⇅ to the list |
| 7 | **No alarms** | "No alarms" and an "Add alarm" button | Tap to add |
| 1b | **All off** | "All alarms off" and "Turn one on in the list" | Swipe ⇅ to the list |
| 2 | **List** | `RoundList` rows "07:10 · Weekdays" with a toggle each; last row "Add alarm" | Tap a row to edit; toggle |
| 3 | **Set time** | `HH:MM` readout; the ring dial (claim band, 5-minute steps, readout tap switches to hours); seven day pills S M T W T F S; "Done" and, for an existing alarm, "Delete" | Drag, tap; back gesture saves |
| 5 | **Ringing** (alert view) | The alarm's `HH:MM` with the shared `.alert-pulse`; caption "Tap to snooze · hold to stop" | Tap: snooze. Hold 2 s: stop (accent arc fills round the edge while held) |
| 6 | **Silent clocks** | Ringing view plus the chip "No speaker on this clock" when `deviceHasAudio` is false | as 5 |
| 8 | **Missed** (settled) | Still, muted "Missed" / `HH:MM` / "Tap to clear" | Tap: dismiss |

The ⇅ swipe uses `setVerticalSwipeCallback` and the set-time back gesture `setBackCallback`, both
with HabitsApp's guarded cleanup (capture the callback, clear only if it is still ours), per
`.claude/rules/gestures-and-navigation.md` (NAV-1, NAV-2).

### Config — `src/shared/schemas/app.alarm.ts`

```ts
export const alarmAppSchema = z.object({
  snoozeMinutes: z.number().int().min(1).max(30).default(9),
  sound: z.boolean().default(true),
  gentleWakeMinutes: z.number().int().min(0).max(30).default(10),
});
```

Meta: `sound` "Plays on clocks with a speaker (Fast). Others flash at full brightness.";
`gentleWakeMinutes` "Minutes of brightening before the alarm. 0 turns it off."

## Wiring

`npm run new:app -- alarm`; capability row `alarm: ['ticks', 'multiView']` once the minute
interval and swipe slot exist (an empty row until then); `public/alarm-thumb.svg` plus AppGrid
tile, `APP_ICONS` and admin name `Alarm` (alphabetical); README / foundation / architecture to 17
apps; `npm run snapshot:schemas`; `docs/health.md` regenerated in each task's commit (its tree scan
counts files); `npm run analyze -- --write` at the end.

## Testing

- Core: settle at `firedAt + ringMs`; old stored alerts without the new fields still load; the
  lease is acquired for `bright` alerts only and released on settle and on dismiss; one wake
  request per ring with the right `untilMs` (fetch mocked); `planNext` returns `lead` at
  `firesAt − leadMs` and only once; `leading` clears on fire and cancel; `rampTransition` values.
- Server: the wake route answers 403 to a non-loopback address, 400 to a bad body, and clamps to
  30 minutes; `decidePower` returns true inside a wake, and falls back to the schedule after it.
- Alarm logic: `nextOccurrence` for once (today, tomorrow), weekdays, a single day, disabled; a
  year of days in the host time zone (both DST changes on Nick's Mac) always lands on the stated
  `HH:MM` local; `syncAlarmAlerts` schedules, cancels and is idempotent; firing schedules the next
  occurrence and turns a once-alarm off; snooze schedules `alarm:<id>:snooze`; store persistence
  and corrupt storage.
- Alarm screens: resting, no alarms, all off; list toggle; set-time dial in hours and minutes,
  day pills, Done, Delete; ringing tap snoozes; a 2 s hold stops (fake timers) and a shorter one
  does not; missed; the silent chip from the device flag.
- Rendered: every screen at 1080 × 1080 in both palettes; in the dev kiosk, an alarm two minutes
  ahead with gentle wake at 1 minute fires over another app, the night filter's transition shows
  the ramp, and the dev server answers the wake request.

## Needs Nick

Hearing the alarm and seeing it on a round panel need an Alarm screen added in the admin. A true
wake from the sleep window needs a sleep schedule set in the admin and an alarm inside it.

## Out of scope

- Editing alarms from the admin (sub-project 4).
- Volume, sound choice, vibration-style escalation, auto-snooze.
- slowclock (LVGL).
