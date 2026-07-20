# Calendar app — Month / Week / Details views (round display)

**Date:** 2026-07-19
**Status:** Approved design, ready for implementation plan
**Scope:** Replace the static "today's date" calendar face with a three-view, read-only calendar (Month → Week → Details) built for the circular 1080×1080 kiosk.

---

## 1. Purpose & constraints

The current calendar app ([`src/apps/calendar/CalendarApp.tsx`](../../../src/apps/calendar/CalendarApp.tsx)) is a single static face: a big red date tile plus up to three upcoming event lines. It offers no month/week overview, no interaction, and no event detail.

This design turns it into a **read-only, glanceable-but-drillable** calendar with three views. Read-only is a deliberate scope decision: no event creation/editing/quick-actions on the touchscreen. Data comes from the existing server-side ICS feed only.

**Hard constraints discovered in the codebase (these shape the whole design):**

- **Circular viewport.** The round devices render a 1080×1080 *circle*. A naïve `grid-cols-7` month grid clips its corner cells against the physical bezel. All view content must live in the circle's wide **center band**; corners are decorative/empty.
- **Horizontal swipe is reserved.** [`useGestures.ts:78-82`](../../../src/core/hooks/useGestures.ts) hardwires horizontal swipe to switch *apps* (`swipeToNext`/`swipeToPrev`) with no per-app override. The calendar's most instinctive gesture (swipe left/right through time) would eject the user into the next app. Navigation must route around this.
- **One delegated swipe axis + taps.** Only **vertical** swipe delegates to the active app via `verticalSwipeCallback` ([`useGestures.ts:68`](../../../src/core/hooks/useGestures.ts)). Taps are free (`filterTaps: true`). These are the only two input axes available inside the app.
- **No router in the kiosk.** The kiosk is store-driven; react-router must not be introduced here. The three views are internal component state.
- **Server returns only 24h.** [`getCalendarEvents`](../../../server/handlers.ts) caps at a 24-hour horizon and the `CalendarEvent` type carries only `{ start, end, title, allDay }` — insufficient for month/week ranges and for a details view.
- **Active-aware effects.** Background apps must not tick; all intervals/fetches gate on `props.isActive` (kiosk runs for weeks on a Pi).
- **Honest offline.** On fetch failure the views show an explicit offline tell — never fabricated events.
- **Secrets server-side.** The ICS URL stays on the server (`CALENDAR_ICS_URL`); the browser only ever calls `/api/calendar`.

**Success criteria:**

- From Month, a user can reach any event's full detail in at most two taps.
- Every view is fully legible inside the circle with no clipped content.
- Month, Week, and Details each read as a distinct altitude (overview → agenda → single event).
- No leaked timers when the app is backgrounded; no faked data when offline.

---

## 2. The three views

All three keep content within the circle's inscribed center band. A **back chevron** sits at the top of the circle in Week and Details.

### 2.1 Month — "center-band focus"

- The **current week** (the week containing `focusDate`) is enlarged and centered in the circle's widest horizontal band.
- Weeks earlier in the month fade and shrink toward the top arc; later weeks fade toward the bottom arc.
- Days are rendered as numbers only. Days with ≥1 event get a small dot beneath the number. Today is accented (red `#E33030`).
- This is an **overview** altitude: orientation + "which days have things," not event content.
- **Tap a week row** → Week view for that week.
- **Vertical swipe up/down** → previous/next month (`focusDate` shifts by one month).

### 2.2 Week — "strip + agenda"

- **7-day context strip** across the top band: weekday initial + date for each day, a dot on days with events, today accented. Gives at-a-glance "how busy is this week."
- **Agenda list** in the center band: events grouped by day, each row = calendar-color dot · time · title. All-day events sort to the top of their day. Today's group is labelled and accented.
- Vertically **scrolls locally** if the week is busy (opt back into scroll per the global touch-lock convention). Most weeks fit without scrolling.
- **Tap an event** → Details.
- **Vertical swipe up/down** → previous/next week (`focusDate` shifts by 7 days).
- **Back chevron** → Month.

### 2.3 Details — single event

- Centered vertical read within the inscribed width: calendar-color chip, **title**, date line (today accented), time range (or "All day"), location, notes/description, and a relative line ("in 3 hours" / "in 2 days" / "now").
- Fields **hide gracefully** when the underlying event lacks them (no empty "Location:" labels).
- **Back chevron** → Week (returns to the week the event belongs to).

---

## 3. Navigation model

Two input axes (vertical swipe + tap) connect three views:

| Action | Month | Week | Details |
|---|---|---|---|
| Tap content | week → Week | event → Details | — |
| Vertical swipe ↕ | prev/next **month** | prev/next **week** | — |
| Back chevron (top) | — | → Month | → Week |

- Registered through `setVerticalSwipeCallback(dir => …)` while the app is active (mirrors HabitsApp's view-switching pattern), cleared on unmount/deactivate.
- Registering the vertical callback means swipe-down no longer opens the grid *from within the calendar*; the grid remains reachable via 3-finger tap and pinch-in (global, unchanged). This matches existing HabitsApp behavior and is acceptable.
- Horizontal swipe continues to switch apps (unchanged, not intercepted).

---

## 4. Data flow & backend changes

### 4.1 Server — `/api/calendar`

Extend the existing route ([`api-mount.ts:29`](../../../server/api-mount.ts)) and handler ([`getCalendarEvents`](../../../server/handlers.ts)):

- **Accept a range:** `GET /api/calendar?from=<ISO>&to=<ISO>`. Returns all events *overlapping* `[from, to]`. When params are absent, default window = `now → now + 31d` (keeps any legacy caller working and covers a typical month).
- **Widen recurrence:** the existing `rrule.between(now, horizon)` becomes `rrule.between(from, to, true)` so recurring events expand across the requested range.
- **Richer events:** extend the parser to read `location` and `description` (and the event `uid`) from each VEVENT.

### 4.2 Shared type

`CalendarEvent` ([`src/api/types.ts`](../../../src/api/types.ts)) gains:

```ts
export interface CalendarEvent {
  start: string;
  end: string;
  title: string;
  allDay: boolean;
  uid: string;              // stable id for selection / keys
  location?: string;        // Details view
  description?: string;     // Details view (notes)
  category?: string;        // optional, drives color when present
}
```

`location`/`description`/`category` are optional so a feed lacking them still works.

### 4.3 Client fetching

- On becoming active (and on time-navigation that moves outside the cached range), fetch the range the current view needs:
  - Month: the visible month ± the spillover weeks shown.
  - Week: the focused week (usually already covered by a wider cached fetch).
- Reuse the **localStorage last-good cache** pattern (`src/shared/local-config.ts` style) so a brief outage still renders the last known events, with an offline tell.
- Poll interval gated on `isActive` (e.g. every 5 min, matching the current app), cleared on deactivate.
- **Offline tell:** Month/Week show their structure with a small "can't reach calendar" indicator instead of events. Never render placeholder events as if live.

### 4.4 Colors

One ICS feed means most events share context. Color is derived from the event's `CATEGORIES` value when present (stable hash → fixed palette); otherwise a single accent is used with **today** emphasized in red. The multi-color agenda in the mockups is illustrative, not a promise of per-event color when the feed has no categories.

---

## 5. Config schema

Update [`src/shared/schemas/app.calendar.ts`](../../../src/shared/schemas/app.calendar.ts). The old face-oriented fields (`lookaheadHours`, `maxEvents`) no longer map to the new views and are removed/replaced:

```ts
export const calendarAppSchema = z.object({
  source: z.string().default('default'),                       // ICS URL or "default"
  weekStart: z.enum(['monday', 'sunday']).default('monday'),   // EU default
  defaultView: z.enum(['month', 'week']).default('month'),
  timeFormat: z.enum(['24h', '12h']).default('24h'),           // matches clock context
});
```

The **registry-coherence test** (`src/shared/registry-coherence.test.ts`) pins schemas to the app registry — `npm test` will flag any mismatch, so the schema + registry stay in sync.

**Chosen defaults:** week starts **Monday**, landing view **Month**, **24h** time.

---

## 6. Component structure

Keep units small and single-purpose (the current file is one 72-line component; the new app is larger and should be decomposed):

```
src/apps/calendar/
  CalendarApp.tsx        // owns view state, focusDate, selectedEvent; registers vertical swipe; data fetching
  MonthView.tsx          // center-band month, fading weeks, event dots
  WeekView.tsx           // 7-day strip + grouped agenda
  DetailsView.tsx        // single-event centered read
  BackChevron.tsx        // shared top-of-circle back affordance
  useCalendarEvents.ts   // fetch + cache + offline state for a date range
  calendar-utils.ts      // week/month math, grouping, weekStart handling, relative-time
  index.ts               // registerApp (unchanged shape)
```

Each unit is independently understandable: view components are presentational (receive events + callbacks), `useCalendarEvents` owns data, `calendar-utils` owns date math (unit-testable in isolation).

---

## 7. Edge cases & error handling

- **Offline / no feed configured:** structure renders with an offline tell; no fake events. Details is only reachable from real events, so N/A there.
- **Empty week/month:** Week shows the strip with no dots and an "Nothing this week" line; Month shows dot-less days.
- **All-day events:** sort to the top of their day in Week; Details shows "All day" instead of a time range.
- **Long titles/locations/notes:** truncate with ellipsis in Week; wrap within inscribed width in Details.
- **Recurring events:** expanded server-side across the requested range via `rrule.between`.
- **Time navigation beyond cached range:** triggers a fetch for the new range; shows last-good/loading state meanwhile.
- **Backgrounded app:** all intervals and the vertical-swipe callback are torn down on deactivate/unmount — no ticking, no leaked handlers.

---

## 8. Testing

- **Unit (`calendar-utils`):** week/month bucketing, Monday-vs-Sunday week starts, event→day grouping, all-day sorting, relative-time formatting. Deterministic with injected "now."
- **Server:** `/api/calendar?from&to` range filtering and recurrence expansion across a multi-week range; parser extracts `location`/`description`/`uid`.
- **Registry coherence:** existing test guards the updated schema.
- **Navigation invariants:** the app sets/clears `verticalSwipeCallback` correctly on activate/deactivate.

---

## 9. Explicitly out of scope (YAGNI)

- Event creation / editing / deletion / quick-actions (read-only by decision).
- Multiple calendar accounts or a writable backend (Google Calendar connector, etc.).
- Day view / year view.
- Drag-to-scrub time. Horizontal-swipe time navigation (blocked by the app-switch gesture).
- Cross-renderer LVGL parity (the `slow` native device is not in scope for this app).
