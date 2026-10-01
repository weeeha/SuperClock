# Countdown app — design

**Date:** 2026-10-01
**Status:** Approved (Nick, this session). Sub-project 1 of 4 in the missing-apps round
(Countdown → background alerts + Timer → Alarm → admin-editable content + Notes).
**Source:** Admin wireframe D20 (`122:1079`, Admin Panel page) and the kiosk draft drawn this
session, section **Countdown** `177:1011` on the Designs page of the
[fresh-thinking board](https://www.figma.com/board/JAjMCsw8hXx38locrxP5gd?node-id=177-1011).

## What it is

A kiosk app that shows how many days are left until one date. The number is the screen;
a short label under it says what the date is. On the day it says "Today". After the date it
keeps counting, upward and in muted ink, so the screen always says something true. More
than one countdown means more than one Countdown screen instance: each instance carries its
own config (`screenInstanceSchema.config`), so nothing extra is built for that.

## Decisions

| # | Decision | Choice | Why |
|---|---|---|---|
| 1 | After the date | **Count up** in `--ink-muted`: "12 days since Tokyo" (Nick, this session) | The screen stays true; the same app serves "days since" |
| 2 | Targets per screen | **One.** Several countdowns = several instances | Instances already carry per-instance config |
| 3 | Day arithmetic | **Local calendar dates**, never `ms / 86 400 000` | A DST change makes a day 23 or 25 hours; division drops or adds a day |
| 4 | Re-render | **One `setTimeout` to the next local midnight**, only while `isActive`; recompute on activation | Day resolution needs nothing faster; no per-second work on a weeks-long kiosk |
| 5 | Accent | **Only the progress ring**, and only before the date | One saturated accent quantity; the days/weeks styles carry none |
| 6 | Type | **Only sizes already in the tree**: number `27vmin`, label `2.6vmin` (`TYPE.md`), caption `2.2vmin` (`TYPE.sm`) | The font-size ratchet (`CEILINGS.fontSizes` 54) may not grow. `TYPE.lg` (3.4vmin) is not in the tree, so the label takes the glance default |
| 7 | 10 000+ days | **Render in weeks** regardless of `style` | Keeps the number at four digits or fewer inside the disc |
| 8 | Out of scope | slowclock (LVGL), the clock-face complication variant | Slow is excluded fleet-wide for new apps; the complication is marked "candidate" on D20 |

## Screens and states (board frames 1 to 6)

Coordinates are in 1000 × 1000 disc units (the 1080 px viewport; `vmin` = 10 units).
Text is HTML, absolutely positioned and centred horizontally, so the label can wrap. The
ring is an SVG with `viewBox="0 0 1000 1000"`.

| # | State | Number / headline | Label | Other |
|---|---|---|---|---|
| 1 | **Days** (default) | days remaining, `27vmin`, `--ink`, centre at y 444 | "days to {label}", `2.6vmin`, `--ink`, centre at y 678 | Singular: "1 day to {label}" |
| 2 | **Weeks** | whole weeks | "weeks, {n} days to {label}"; remainder 0 → "weeks to {label}"; 1 week → "week" | |
| 3 | **Progress ring** | as Days | as Days | Ring, plus caption "since {startDate, d MMM yyyy}" `2.2vmin` `--ink-muted` at y 733 |
| 4 | **Today** | "Today", `27vmin`, `--ink` | "{label}" | Applies to every style; the ring renders full in `--ink-muted` |
| 5 | **Since** | days since, `27vmin`, `--ink-muted` | "days since {label}" / "1 day since {label}", `--ink-muted` | Weeks style: "weeks, {n} days since {label}". Ring style: full ring in `--ink-muted`, no accent |
| 6 | **Not set up** | "No date yet", `2.6vmin` weight 500, `--ink`, y 467 | "Set a target date for this screen in the admin." `2.2vmin` `--ink-muted`, y 533, max width 520 | Rendered whenever `targetDate` is empty or not a valid date |

**Label rules.** Empty label → the label line drops the "to {label}" part: "214 days",
"Today", "12 days since". Labels are capped at 40 characters by the schema, wrap within a
620-unit width, and are clamped to two lines (`line-clamp: 2`). At y 678 the disc's chord
is 934 units wide and at the second line (y ≈ 722) 896 units, so both lines stay inside
the disc.

**Progress ring geometry.** Circle centred at (500, 500), `r = 447`, `stroke-width = 26`
(outer edge at radius 460, inside the disc). Track: `--fill-subtle`, full circle. Elapsed:
`--color-accent`, drawn from 12 o'clock clockwise (`rotate(-90 500 500)`), length
`2πr × elapsedFraction` via `stroke-dasharray`, `stroke-linecap="butt"`.
`elapsedFraction = clamp((today − startDate) / (targetDate − startDate), 0, 1)` in
calendar days. If `startDate` is empty, invalid, or not before `targetDate`, the screen
renders as state 1 and the caption slot reads "Add a start date to show progress"
(`--ink-muted`), never a guessed fraction.

**Motion.** None. The screen changes once a day at local midnight with no transition.

## Data

New schema `src/shared/schemas/app.countdown.ts`:

```ts
export const countdownAppSchema = z.object({
  label: z.string().max(40).default(''),
  targetDate: z.string().default(''),        // 'YYYY-MM-DD' or '' (not set up)
  style: z.enum(['days', 'weeks', 'progress-ring']).default('days'),
  startDate: z.string().default(''),         // 'YYYY-MM-DD' or ''; only read by progress-ring
});
```

Meta: `targetDate` and `startDate` get `format: 'date'`; `startDate` gets
`showIf: (v) => v.style === 'progress-ring'`. Dates stay plain strings so an empty value is
valid and an invalid one degrades to "Not set up" rather than failing `safeParse` and
reverting the whole config. `label` is born with its `max(40)`, because narrowing a bound
later is a breaking schema change under the snapshot gate.

The component consumes it the Calendar way: `countdownAppSchema.safeParse(config ?? {})`,
falling back to `countdownAppSchema.parse({})`.

## Logic

A pure module `src/apps/countdown/countdown-state.ts`:

```ts
type CountdownView =
  | { kind: 'not-set-up' }
  | { kind: 'until'; unit: 'days' | 'weeks'; value: number; remainderDays: number; ring: RingView | null }
  | { kind: 'today'; ring: RingView | null }
  | { kind: 'since'; unit: 'days' | 'weeks'; value: number; remainderDays: number; ring: RingView | null };

type RingView = { fraction: number; spent: boolean } | { missingStart: true };

export function countdownState(today: LocalDate, config: CountdownAppConfig): CountdownView;
export function msUntilNextLocalMidnight(now: Date): number;
```

- A date string is valid when it matches `/^\d{4}-\d{2}-\d{2}$/` and survives a round trip
  through `Date.UTC` unchanged (so `2026-02-30` is invalid). Anything else is treated as
  empty.
- `LocalDate` is `{ y, m, d }` read from the device's local clock. Day differences use
  `Date.UTC(y, m − 1, d)` on both sides, so time zones and DST cannot shift the count.
- Weeks: `value = floor(days / 7)`, `remainderDays = days % 7`. `days ≥ 10 000` forces
  `unit: 'weeks'` (decision 7).
- `ring` is non-null only for `style: 'progress-ring'`.

The component holds `today` in state. While `isActive`, it schedules one
`setTimeout(msUntilNextLocalMidnight(new Date()) + 1000)`, which sets `today` and
reschedules. On becoming active it recomputes `today` immediately, so a screen that was
swiped away for three days is right on return. Cleanup clears the timeout. No
`setInterval` and no rAF, so the capability row honestly declares `ticks: false`
(`app-capabilities.test.ts` defines ticks as `setInterval` or `requestAnimationFrame`).

## Admin

- `src/shared/types.ts`: `FieldMeta.format` gains `'date'`
  (`'color' | 'url' | 'time' | 'date'`).
- `src/admin/lib/schema-form.tsx`: a string field with `format: 'date'` renders the existing
  text input with `type="date"`, value `YYYY-MM-DD`, empty allowed. This is the D20 date
  widget and the last missing field type in the admin template.
- `src/admin/lib/app-names.ts`: `countdown: 'Countdown'`.
- `src/admin/lib/screen-art.ts`: an `APP_ICONS` entry for `countdown`.

## Wiring

`npm run new:app -- countdown` emits the component, `index.ts` registration, the
side-import in `src/apps/index.ts`, the `ALL_KIOSK_APP_IDS` entry, an `APP_CAPABILITIES`
row, the schema file plus its `schema-registry.ts` entries, and a todo test that stays red
until the component is implemented. Set by hand afterwards:

- `APP_CAPABILITIES.countdown`: `fetches: false`, `ticks: false`, `multiView: false`, no
  hardware needs.
- The kiosk app-grid tile in `src/core/components/AppGrid.tsx` (a hashed PNG in `public/`,
  drawn in the existing tiles' style) and the admin art above.
- `npm run snapshot:schemas` (a new schema is a minor change), `npm run report`
  (`docs/health.md`), `npm run analyze -- --write` (declared-vs-read report).

## Testing

- `src/apps/countdown/countdown-state.test.ts`: 214 days until; "1 day"; today; since,
  including "1 day since"; weeks with and without a remainder, and "1 week"; 10 000+ days
  forced into weeks; across a spring-forward and a fall-back date in America/New_York (the
  count must not change); not set up for an empty and an invalid `targetDate`; ring fraction
  at start, middle, end, clamped below 0 and above 1, and `missingStart` for empty,
  invalid, and start-after-target; `msUntilNextLocalMidnight` across a DST night.
- `src/apps/countdown/CountdownApp.test.tsx`: renders each of the six states from config;
  the label clamps at two lines; no timer is scheduled while `isActive` is false.
- Gates: `./scripts/gates.sh` green; the design ratchet's font-size count does not grow
  (decision 6); `npm run check:rules` clean on the new files.
- Rendered: the six states at 1080 × 1080 in the browser in both palettes (unslop Phase 2:
  squint, counts, contrast, circle-crop, hostile 40-character label), then on fastclock.

## Out of scope

- slowclock / LVGL.
- The clock-face complication version of the same data.
- Any tap or swipe interaction on the screen. Config lives in the admin.
- Yearly repeat (birthdays, anniversaries). Decided against this session; adding it later
  is a defaulted field, a minor schema change.
