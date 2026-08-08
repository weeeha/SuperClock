# Calendar "Not Configured" Tell Implementation Plan

> **For agentic workers:** small plan, executed inline in the authoring session.

**Goal:** A kiosk with no `CALENDAR_ICS_URL` says "calendar not configured"; an upstream ICS failure says "offline · cached" — neither renders as a live empty calendar.

**Discovery that widened scope:** `getCalendarEvents` (server/handlers.ts) swallows BOTH the unconfigured case and upstream failures into `[]` + HTTP 200, so the client's `offline` flag today only fires if the kiosk can't reach its own server. Both dishonesty paths get fixed.

**Design:**
- Server route `/api/calendar` (server/api-mount.ts): `!CALENDAR_ICS_URL` → `503 { error: 'calendar_not_configured' }`; upstream fetch/parse failure → `502 { error: 'calendar_upstream_failed' }`; else `200 [events]`. `getCalendarEvents` stops swallowing (empty-url branch and catch removed — it throws; the route catches). `eventsFromParsed` untouched.
- Client `useCalendarEvents` (src/apps/calendar): result gains `notConfigured: boolean`. 503 + `calendar_not_configured` body → `notConfigured` (not offline, no cache implied); any other failure → `offline` with last-good cache (existing semantics, now actually reachable).
- `CalendarApp.tsx` tell: `notConfigured` → `calendar not configured`; else `offline` → `offline · cached` (same bottom-rim styling).
- Board close-out: update the Calendar wireframe frame-7 annotation (PROPOSAL → implemented).

### Tasks
1. Server: route branches + un-swallow `getCalendarEvents`; curl-verify 503 shape locally.
2. Client: hook `notConfigured` + tell in CalendarApp.
3. Gate (vitest/lint/tsc/build) + live browser check (dev has no CALENDAR_ICS_URL → tell must appear).
4. Docs: none needed beyond this plan. Board annotation update.
