# Calendar App Views Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the static "today's date" calendar face with a read-only three-view calendar (Month → Week → Details) built for the circular 1080×1080 kiosk.

**Architecture:** One stateful `CalendarApp` owns `view`/`focusDate`/`selectedEvent`, registers a vertical-swipe callback for time navigation, and fetches events by date range via a `useCalendarEvents` hook (localStorage last-good cache + offline flag). Three presentational view components (Month/Week/Details) render inside the circle's center band. The server's `/api/calendar` grows range params and richer event fields. All date math lives in a pure, unit-tested `calendar-utils` module.

**Tech Stack:** React 19 + TypeScript (`verbatimModuleSyntax`, `import type`, no enums), Zustand navigation store, Tailwind v4, Express 5 + `node-ical`, Vitest.

**Spec:** [docs/superpowers/specs/2026-07-19-calendar-app-views-design.md](../specs/2026-07-19-calendar-app-views-design.md)

---

## File Structure

**Create:**
- `src/apps/calendar/calendar-utils.ts` — pure date math (week/month grids, grouping, relative time, range overlap, weekStart)
- `src/apps/calendar/calendar-utils.test.ts` — unit tests for the above
- `src/apps/calendar/useCalendarEvents.ts` — fetch-by-range hook + localStorage cache + offline state
- `src/apps/calendar/BackChevron.tsx` — shared top-of-circle back affordance
- `src/apps/calendar/MonthView.tsx` — center-band month overview
- `src/apps/calendar/WeekView.tsx` — 7-day strip + grouped agenda
- `src/apps/calendar/DetailsView.tsx` — single-event centered read
- `server/handlers.calendar.test.ts` — tests for range filtering + field extraction

**Modify:**
- `src/api/types.ts:1-6` — extend `CalendarEvent` (add `uid`, `location?`, `description?`, `category?`)
- `server/handlers.ts` — `getCalendarEvents(icsUrl, from, to)` range + field extraction
- `server/api-mount.ts:29-32` — `/api/calendar?from&to` wiring
- `src/shared/schemas/app.calendar.ts` — new config shape (`weekStart`/`defaultView`/`timeFormat`)
- `src/apps/calendar/CalendarApp.tsx` — full rewrite into the orchestrator

**Unchanged (verify only):** `src/apps/calendar/index.ts`, `src/shared/schema-registry.ts:55`, `src/shared/capabilities.ts` (calendar already registered).

---

## Task 1: Date-math utilities (`calendar-utils.ts`)

Pure functions, no React, no `Date.now()` inside logic (callers pass `now`). This is the TDD core — everything testable in isolation.

**Files:**
- Create: `src/apps/calendar/calendar-utils.ts`
- Test: `src/apps/calendar/calendar-utils.test.ts`

- [ ] **Step 1: Write the failing tests**

```ts
// src/apps/calendar/calendar-utils.test.ts
import { describe, it, expect } from 'vitest';
import type { CalendarEvent } from '../../api/types';
import {
  startOfWeek,
  weekDays,
  monthWeeks,
  addMonths,
  addDays,
  eventsForDay,
  groupEventsByDay,
  overlapsRange,
  relativeTime,
  sameDay,
} from './calendar-utils';

// 2026-07-19 is a Sunday. July 1 2026 is a Wednesday.
const jul19 = new Date(2026, 6, 19, 10, 0, 0);

function ev(partial: Partial<CalendarEvent>): CalendarEvent {
  return {
    uid: 'u', title: 't', start: jul19.toISOString(), end: jul19.toISOString(),
    allDay: false, ...partial,
  };
}

describe('startOfWeek', () => {
  it('Monday start: Sunday Jul 19 → Monday Jul 13', () => {
    expect(startOfWeek(jul19, 'monday')).toEqual(new Date(2026, 6, 13));
  });
  it('Sunday start: Sunday Jul 19 → Sunday Jul 19', () => {
    expect(startOfWeek(jul19, 'sunday')).toEqual(new Date(2026, 6, 19));
  });
});

describe('weekDays', () => {
  it('returns 7 consecutive dates from the week start', () => {
    const days = weekDays(jul19, 'monday');
    expect(days).toHaveLength(7);
    expect(days[0]).toEqual(new Date(2026, 6, 13));
    expect(days[6]).toEqual(new Date(2026, 6, 19));
  });
});

describe('monthWeeks', () => {
  it('July 2026 (Monday start) yields whole weeks covering the month', () => {
    const weeks = monthWeeks(jul19, 'monday');
    // first week starts on/before Jul 1, last week ends on/after Jul 31
    expect(weeks[0][0].getTime()).toBeLessThanOrEqual(new Date(2026, 6, 1).getTime());
    const last = weeks[weeks.length - 1];
    expect(last[6].getTime()).toBeGreaterThanOrEqual(new Date(2026, 6, 31).getTime());
    weeks.forEach((w) => expect(w).toHaveLength(7));
  });
});

describe('addMonths / addDays', () => {
  it('addMonths(+1) from Jul 19 → Aug 19', () => {
    expect(addMonths(jul19, 1)).toEqual(new Date(2026, 7, 19, 10, 0, 0));
  });
  it('addDays(+7) from Jul 19 → Jul 26', () => {
    expect(addDays(jul19, 7)).toEqual(new Date(2026, 6, 26, 10, 0, 0));
  });
});

describe('sameDay', () => {
  it('ignores time of day', () => {
    expect(sameDay(new Date(2026, 6, 19, 1), new Date(2026, 6, 19, 23))).toBe(true);
    expect(sameDay(new Date(2026, 6, 19), new Date(2026, 6, 20))).toBe(false);
  });
});

describe('eventsForDay', () => {
  it('matches events whose start is on that calendar day', () => {
    const e = ev({ start: new Date(2026, 6, 19, 18, 30).toISOString() });
    expect(eventsForDay([e], new Date(2026, 6, 19))).toEqual([e]);
    expect(eventsForDay([e], new Date(2026, 6, 20))).toEqual([]);
  });
});

describe('groupEventsByDay', () => {
  it('buckets by day and sorts all-day before timed, then by start', () => {
    const allDay = ev({ uid: 'a', allDay: true, title: 'Conf', start: new Date(2026, 6, 16).toISOString() });
    const nine = ev({ uid: 'b', title: 'Standup', start: new Date(2026, 6, 16, 9).toISOString() });
    const two = ev({ uid: 'c', title: 'Dentist', start: new Date(2026, 6, 16, 14).toISOString() });
    const groups = groupEventsByDay([two, nine, allDay], weekDays(jul19, 'monday'));
    const thu = groups.find((g) => sameDay(g.day, new Date(2026, 6, 16)))!;
    expect(thu.events.map((e) => e.uid)).toEqual(['a', 'b', 'c']);
  });
  it('omits days with no events', () => {
    const groups = groupEventsByDay([], weekDays(jul19, 'monday'));
    expect(groups).toEqual([]);
  });
});

describe('overlapsRange', () => {
  it('true when the event intersects [from,to]', () => {
    const e = ev({ start: new Date(2026, 6, 19, 18).toISOString(), end: new Date(2026, 6, 19, 20).toISOString() });
    expect(overlapsRange(e, new Date(2026, 6, 19), new Date(2026, 6, 20))).toBe(true);
    expect(overlapsRange(e, new Date(2026, 6, 20), new Date(2026, 6, 21))).toBe(false);
  });
});

describe('relativeTime', () => {
  it('formats future distances from now', () => {
    const now = new Date(2026, 6, 19, 15, 30);
    expect(relativeTime(new Date(2026, 6, 19, 18, 30), now)).toBe('in 3 hours');
    expect(relativeTime(new Date(2026, 6, 21, 15, 30), now)).toBe('in 2 days');
    expect(relativeTime(new Date(2026, 6, 19, 16, 0), now)).toBe('in 30 minutes');
  });
  it('reads "now" within a minute and "started" in the past', () => {
    const now = new Date(2026, 6, 19, 15, 30);
    expect(relativeTime(new Date(2026, 6, 19, 15, 30, 20), now)).toBe('now');
    expect(relativeTime(new Date(2026, 6, 19, 14, 30), now)).toBe('started 1 hour ago');
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -- calendar-utils`
Expected: FAIL — module `./calendar-utils` not found / exports undefined.

- [ ] **Step 3: Implement `calendar-utils.ts`**

```ts
// src/apps/calendar/calendar-utils.ts
import type { CalendarEvent } from '../../api/types';

export type WeekStart = 'monday' | 'sunday';

/** Midnight of the given date, local time. */
function atMidnight(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

export function sameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

export function startOfWeek(d: Date, weekStart: WeekStart): Date {
  const base = atMidnight(d);
  const dow = base.getDay(); // 0=Sun..6=Sat
  const offset = weekStart === 'monday' ? (dow + 6) % 7 : dow;
  return addDays(base, -offset);
}

export function addDays(d: Date, n: number): Date {
  const r = new Date(d);
  r.setDate(r.getDate() + n);
  return r;
}

export function addMonths(d: Date, n: number): Date {
  const r = new Date(d);
  r.setMonth(r.getMonth() + n);
  return r;
}

export function weekDays(d: Date, weekStart: WeekStart): Date[] {
  const start = startOfWeek(d, weekStart);
  return Array.from({ length: 7 }, (_, i) => addDays(start, i));
}

/** Whole weeks (each length 7) covering the month that `d` falls in. */
export function monthWeeks(d: Date, weekStart: WeekStart): Date[][] {
  const first = new Date(d.getFullYear(), d.getMonth(), 1);
  const last = new Date(d.getFullYear(), d.getMonth() + 1, 0);
  const gridStart = startOfWeek(first, weekStart);
  const weeks: Date[][] = [];
  let cursor = gridStart;
  // Emit weeks until we've passed the last day of the month.
  while (cursor <= last || weeks.length === 0) {
    weeks.push(Array.from({ length: 7 }, (_, i) => addDays(cursor, i)));
    cursor = addDays(cursor, 7);
    if (weeks.length > 6) break; // safety
  }
  return weeks;
}

export function eventsForDay(events: CalendarEvent[], day: Date): CalendarEvent[] {
  return events.filter((e) => sameDay(new Date(e.start), day));
}

export interface DayGroup {
  day: Date;
  events: CalendarEvent[];
}

/** Buckets events by day across `days`, all-day first then by start time.
 *  Days with no events are omitted. */
export function groupEventsByDay(events: CalendarEvent[], days: Date[]): DayGroup[] {
  const groups: DayGroup[] = [];
  for (const day of days) {
    const dayEvents = eventsForDay(events, day).sort((a, b) => {
      if (a.allDay !== b.allDay) return a.allDay ? -1 : 1;
      return a.start.localeCompare(b.start);
    });
    if (dayEvents.length > 0) groups.push({ day, events: dayEvents });
  }
  return groups;
}

export function overlapsRange(e: CalendarEvent, from: Date, to: Date): boolean {
  const start = new Date(e.start).getTime();
  const end = new Date(e.end).getTime();
  return start < to.getTime() && end > from.getTime();
}

export function relativeTime(target: Date, now: Date): string {
  const diffMs = target.getTime() - now.getTime();
  const absMin = Math.round(Math.abs(diffMs) / 60000);
  if (absMin < 1) return 'now';
  const future = diffMs > 0;
  const unit = pickUnit(absMin);
  const phrase = `${unit.value} ${unit.label}${unit.value === 1 ? '' : 's'}`;
  return future ? `in ${phrase}` : `started ${phrase} ago`;
}

function pickUnit(minutes: number): { value: number; label: string } {
  if (minutes < 60) return { value: minutes, label: 'minute' };
  const hours = Math.round(minutes / 60);
  if (hours < 24) return { value: hours, label: 'hour' };
  return { value: Math.round(hours / 24), label: 'day' };
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test -- calendar-utils`
Expected: PASS (all describe blocks green).

- [ ] **Step 5: Lint**

Run: `npm run lint`
Expected: no errors in `calendar-utils.ts`.

- [ ] **Step 6: Commit**

```bash
git add src/apps/calendar/calendar-utils.ts src/apps/calendar/calendar-utils.test.ts
git commit -m "feat(calendar): pure date-math utilities with tests"
```

---

## Task 2: Extend `CalendarEvent` + server field extraction

**Files:**
- Modify: `src/api/types.ts:1-6`
- Modify: `server/handlers.ts` (`toEvent`, helpers, `getCalendarEvents`)
- Test: `server/handlers.calendar.test.ts`

- [ ] **Step 1: Extend the shared type**

Replace `src/api/types.ts` lines 1-6 with:

```ts
export interface CalendarEvent {
  start: string;
  end: string;
  title: string;
  allDay: boolean;
  uid: string;
  location?: string;
  description?: string;
  category?: string;
}
```

- [ ] **Step 2: Write the failing server test**

`node-ical` parses ICS text via `ical.async.parseICS`. Test the range+field logic against inline ICS by extracting a testable pure function. First, plan to export `eventsFromParsed(data, from, to)` from `handlers.ts`.

```ts
// server/handlers.calendar.test.ts
import { describe, it, expect } from 'vitest';
import ical from 'node-ical';
import { eventsFromParsed } from './handlers';

const ICS = `BEGIN:VCALENDAR
VERSION:2.0
BEGIN:VEVENT
UID:evt-1
SUMMARY:Dinner with Alex
LOCATION:Bar Centrale
DESCRIPTION:Table booked under Nick
DTSTART:20260719T183000Z
DTEND:20260719T203000Z
END:VEVENT
BEGIN:VEVENT
UID:evt-2
SUMMARY:Far Future
DTSTART:20261231T090000Z
DTEND:20261231T100000Z
END:VEVENT
END:VCALENDAR`;

describe('eventsFromParsed', () => {
  const data = ical.parseICS(ICS);
  const from = new Date('2026-07-01T00:00:00Z');
  const to = new Date('2026-08-01T00:00:00Z');

  it('includes events overlapping the range with location/description/uid', () => {
    const events = eventsFromParsed(data, from, to);
    expect(events).toHaveLength(1);
    const e = events[0];
    expect(e.uid).toBe('evt-1');
    expect(e.title).toBe('Dinner with Alex');
    expect(e.location).toBe('Bar Centrale');
    expect(e.description).toBe('Table booked under Nick');
    expect(e.allDay).toBe(false);
  });

  it('excludes events outside the range', () => {
    const events = eventsFromParsed(data, from, to);
    expect(events.find((e) => e.uid === 'evt-2')).toBeUndefined();
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `npm test -- handlers.calendar`
Expected: FAIL — `eventsFromParsed` is not exported.

- [ ] **Step 4: Refactor `handlers.ts` to expose `eventsFromParsed` and use range + fields**

Update `toEvent` and add helpers/export. Replace the calendar section (from `function toEvent` through the end of `getCalendarEvents`) with:

```ts
function readText(value: unknown): string | undefined {
  if (typeof value === 'string') return value.trim() || undefined;
  if (value && typeof value === 'object' && 'val' in value) {
    return String((value as { val: unknown }).val).trim() || undefined;
  }
  return undefined;
}

function toEvent(event: VEvent, start: Date, end: Date, title: string, allDay: boolean): CalendarEvent {
  return {
    start: start.toISOString(),
    end: end.toISOString(),
    title,
    allDay,
    uid: readText(event.uid) ?? `${title}-${start.toISOString()}`,
    location: readText(event.location),
    description: readText(event.description),
    category: readText((event as unknown as { categories?: unknown }).categories),
  };
}

/** Pure: turn parsed ICS data into events overlapping [from, to]. Exported for tests. */
export function eventsFromParsed(
  data: Record<string, unknown>,
  from: Date,
  to: Date,
): CalendarEvent[] {
  const events: CalendarEvent[] = [];

  for (const key of Object.keys(data)) {
    const item = data[key] as { type?: string } | undefined;
    if (!item || item.type !== 'VEVENT') continue;
    const event = item as unknown as VEvent;

    const title = readSummary(event.summary).trim();
    if (!title) continue;
    const allDay = event.datetype === 'date';

    if (event.rrule) {
      const occurrences = event.rrule.between(from, to, true);
      const durationMs =
        event.end && event.start
          ? new Date(event.end as Date).getTime() - new Date(event.start as Date).getTime()
          : 0;
      for (const occurrenceStart of occurrences) {
        const occurrenceEnd = new Date(occurrenceStart.getTime() + durationMs);
        events.push(toEvent(event, occurrenceStart, occurrenceEnd, title, allDay));
      }
      continue;
    }

    const start = event.start ? new Date(event.start as Date) : null;
    const end = event.end ? new Date(event.end as Date) : null;
    if (!start) continue;
    const effectiveEnd = end ?? start;
    // overlap test: start < to AND end > from
    if (start >= to) continue;
    if (effectiveEnd <= from) continue;

    events.push(toEvent(event, start, effectiveEnd, title, allDay));
  }

  events.sort((a, b) => a.start.localeCompare(b.start));
  return events;
}

export async function getCalendarEvents(icsUrl: string, from: Date, to: Date): Promise<CalendarEvent[]> {
  if (!icsUrl) return [];
  try {
    const data = await ical.async.fromURL(icsUrl);
    return eventsFromParsed(data as Record<string, unknown>, from, to);
  } catch (err) {
    console.warn('[api] getCalendarEvents failed:', (err as Error).message);
    return [];
  }
}
```

Note: the old `readSummary` helper and `ONE_DAY_MS` const stay; `ONE_DAY_MS` may now be unused — if `npm run lint` flags it under `noUnusedLocals`, delete the `ONE_DAY_MS` line.

- [ ] **Step 5: Run tests to verify they pass**

Run: `npm test -- handlers.calendar`
Expected: PASS.

- [ ] **Step 6: Typecheck + lint**

Run: `npm run lint`
Expected: no errors. (If `ONE_DAY_MS` is now unused, remove it and re-run.)

- [ ] **Step 7: Commit**

```bash
git add src/api/types.ts server/handlers.ts server/handlers.calendar.test.ts
git commit -m "feat(calendar): server returns ranged events with location/description/uid"
```

---

## Task 3: Wire `/api/calendar?from&to` route

**Files:**
- Modify: `server/api-mount.ts:29-32`

- [ ] **Step 1: Update the route to parse range params with a default window**

Replace `server/api-mount.ts` lines 29-32 with:

```ts
  app.get('/api/calendar', async (req, res) => {
    const now = new Date();
    const fromParam = typeof req.query.from === 'string' ? new Date(req.query.from) : null;
    const toParam = typeof req.query.to === 'string' ? new Date(req.query.to) : null;
    const from = fromParam && !Number.isNaN(fromParam.getTime()) ? fromParam : now;
    const to =
      toParam && !Number.isNaN(toParam.getTime())
        ? toParam
        : new Date(now.getTime() + 31 * 24 * 60 * 60 * 1000);
    const events = await getCalendarEvents(process.env.CALENDAR_ICS_URL ?? '', from, to);
    res.json(events);
  });
```

- [ ] **Step 2: Typecheck**

Run: `npm run build 2>&1 | head -20` (or `npx tsc -b`)
Expected: no type errors from `api-mount.ts` (the `getCalendarEvents` signature now takes 3 args).

- [ ] **Step 3: Manual smoke test the endpoint**

Run: `npm run dev` (starts Vite + in-process API on port 5180). In another shell:
`curl -s 'http://localhost:5180/api/calendar?from=2026-07-01T00:00:00Z&to=2026-08-01T00:00:00Z' | head -c 400`
Expected: `[]` if no `CALENDAR_ICS_URL` configured, or a JSON array of events. Either is fine — confirms the route responds with JSON, not a 500.

- [ ] **Step 4: Commit**

```bash
git add server/api-mount.ts
git commit -m "feat(calendar): /api/calendar accepts from/to range params"
```

---

## Task 4: Config schema update (`app.calendar.ts`)

**Files:**
- Modify: `src/shared/schemas/app.calendar.ts`

- [ ] **Step 1: Replace the schema with the new shape**

```ts
// src/shared/schemas/app.calendar.ts
import { z } from 'zod';
import type { FieldMetaMap } from '../types';

export const calendarAppSchema = z.object({
  source: z.string().default('default'),
  weekStart: z.enum(['monday', 'sunday']).default('monday'),
  defaultView: z.enum(['month', 'week']).default('month'),
  timeFormat: z.enum(['24h', '12h']).default('24h'),
});

export const calendarAppMeta: FieldMetaMap = {
  source: {
    description: 'ICS URL or "default" to use the server\'s configured calendar',
    placeholder: 'https://calendar.example.com/feed.ics',
  },
  weekStart: { description: 'First day of the week' },
  defaultView: { description: 'View shown when the app opens' },
  timeFormat: { description: 'Clock format for event times' },
};

export type CalendarAppConfig = z.infer<typeof calendarAppSchema>;
```

- [ ] **Step 2: Run the registry-coherence + full suite**

Run: `npm test`
Expected: PASS — schema still registered at `schema-registry.ts:55`; coherence test green. (No registry edit needed; the app id and schema key are unchanged.)

- [ ] **Step 3: Commit**

```bash
git add src/shared/schemas/app.calendar.ts
git commit -m "feat(calendar): config schema for weekStart/defaultView/timeFormat"
```

---

## Task 5: Data hook (`useCalendarEvents.ts`)

Fetches events for a date range, caches last-good in localStorage, exposes an offline flag. Gated on `isActive` by the caller passing `enabled`.

**Files:**
- Create: `src/apps/calendar/useCalendarEvents.ts`

- [ ] **Step 1: Implement the hook**

```ts
// src/apps/calendar/useCalendarEvents.ts
import { useEffect, useRef, useState } from 'react';
import type { CalendarEvent } from '../../api/types';

const CACHE_KEY = 'calendar:last-good';
const POLL_MS = 5 * 60 * 1000;

interface Cached {
  events: CalendarEvent[];
}

function loadCache(): CalendarEvent[] {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return [];
    return (JSON.parse(raw) as Cached).events ?? [];
  } catch {
    return [];
  }
}

function saveCache(events: CalendarEvent[]): void {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify({ events } satisfies Cached));
  } catch {
    // storage full/unavailable — non-fatal, we just lose the cache
  }
}

export interface CalendarData {
  events: CalendarEvent[];
  offline: boolean;
  loading: boolean;
}

/** Fetches events overlapping [from,to]. `enabled` should be the app's isActive.
 *  Refetches when the ISO range strings change; polls every 5 min while enabled. */
export function useCalendarEvents(fromIso: string, toIso: string, enabled: boolean): CalendarData {
  const [events, setEvents] = useState<CalendarEvent[]>(loadCache);
  const [offline, setOffline] = useState(false);
  const [loading, setLoading] = useState(true);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;

    async function load() {
      abortRef.current?.abort();
      const ac = new AbortController();
      abortRef.current = ac;
      setLoading(true);
      try {
        const res = await fetch(`/api/calendar?from=${encodeURIComponent(fromIso)}&to=${encodeURIComponent(toIso)}`, {
          signal: ac.signal,
        });
        if (!res.ok) throw new Error(`status ${res.status}`);
        const data = (await res.json()) as CalendarEvent[];
        if (cancelled) return;
        setEvents(data);
        saveCache(data);
        setOffline(false);
      } catch (err) {
        if ((err as Error).name === 'AbortError' || cancelled) return;
        setOffline(true); // keep last-good events already in state
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    const id = setInterval(load, POLL_MS);
    return () => {
      cancelled = true;
      clearInterval(id);
      abortRef.current?.abort();
    };
  }, [fromIso, toIso, enabled]);

  return { events, offline, loading };
}
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc -b`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/apps/calendar/useCalendarEvents.ts
git commit -m "feat(calendar): useCalendarEvents range fetch with cache + offline flag"
```

---

## Task 6: `BackChevron` shared component

**Files:**
- Create: `src/apps/calendar/BackChevron.tsx`

- [ ] **Step 1: Implement**

```tsx
// src/apps/calendar/BackChevron.tsx
interface BackChevronProps {
  label?: string;
  onBack: () => void;
}

/** Top-of-circle back affordance. Absolutely positioned in the circle's top cap. */
export default function BackChevron({ label = 'back', onBack }: BackChevronProps) {
  return (
    <button
      onClick={onBack}
      className="absolute top-[7%] left-1/2 -translate-x-1/2 flex items-center gap-[1vmin]
                 text-white/50 text-[3.4vmin] font-medium bg-transparent border-0"
      aria-label="Back"
    >
      <span className="text-[4vmin] leading-none">&lsaquo;</span>
      {label}
    </button>
  );
}
```

- [ ] **Step 2: Typecheck + commit**

Run: `npx tsc -b` → no errors.

```bash
git add src/apps/calendar/BackChevron.tsx
git commit -m "feat(calendar): shared BackChevron affordance"
```

---

## Task 7: `MonthView` component

Center-band month: current week enlarged, others fade up/down; event days get a dot; today accented. Tap a week → `onSelectWeek(weekStartDate)`.

**Files:**
- Create: `src/apps/calendar/MonthView.tsx`

- [ ] **Step 1: Implement**

```tsx
// src/apps/calendar/MonthView.tsx
import type { CalendarEvent } from '../../api/types';
import { monthWeeks, eventsForDay, sameDay, type WeekStart } from './calendar-utils';

interface MonthViewProps {
  focusDate: Date;
  now: Date;
  events: CalendarEvent[];
  weekStart: WeekStart;
  offline: boolean;
  onSelectWeek: (day: Date) => void;
}

const RED = '#E33030';

export default function MonthView({ focusDate, now, events, weekStart, offline, onSelectWeek }: MonthViewProps) {
  const weeks = monthWeeks(focusDate, weekStart);
  const monthLabel = focusDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
  // Index of the week containing `now` (for emphasis); -1 if now is outside this month grid.
  const currentIdx = weeks.findIndex((w) => w.some((d) => sameDay(d, now)));

  return (
    <div className="relative h-full w-full bg-black overflow-hidden">
      <p className="absolute top-[7%] left-0 right-0 text-center text-white font-medium text-[3.6vmin]">
        {monthLabel}
      </p>

      <div className="absolute inset-0 flex flex-col items-center justify-center gap-[0.6vmin]">
        {weeks.map((week, wi) => {
          const distance = currentIdx < 0 ? 0 : Math.abs(wi - currentIdx);
          const isCurrent = wi === currentIdx;
          const opacity = isCurrent ? 1 : Math.max(0.3, 0.7 - distance * 0.18);
          const size = isCurrent ? 3.6 : Math.max(1.8, 2.6 - distance * 0.3);
          return (
            <button
              key={wi}
              onClick={() => onSelectWeek(week[0])}
              className="flex justify-center gap-[1.2vmin] bg-transparent border-0 w-[70%]"
              style={{ opacity }}
            >
              {week.map((day) => {
                const inMonth = day.getMonth() === focusDate.getMonth();
                const isToday = sameDay(day, now);
                const hasEvent = eventsForDay(events, day).length > 0;
                return (
                  <span
                    key={day.toISOString()}
                    className="relative flex-1 text-center"
                    style={{
                      fontSize: `${size}vmin`,
                      color: isToday ? RED : inMonth ? '#fff' : 'rgba(255,255,255,0.25)',
                      fontWeight: isToday ? 600 : 400,
                    }}
                  >
                    {day.getDate()}
                    {hasEvent && (
                      <span
                        className="absolute left-1/2 -translate-x-1/2 rounded-full"
                        style={{
                          bottom: '-0.4vmin', width: '0.7vmin', height: '0.7vmin',
                          background: isToday ? RED : '#fff',
                        }}
                      />
                    )}
                  </span>
                );
              })}
            </button>
          );
        })}
      </div>

      {offline && (
        <p className="absolute bottom-[10%] left-0 right-0 text-center text-white/40 text-[2.4vmin]">
          can’t reach calendar
        </p>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Typecheck + commit**

Run: `npx tsc -b` → no errors.

```bash
git add src/apps/calendar/MonthView.tsx
git commit -m "feat(calendar): MonthView center-band overview"
```

---

## Task 8: `WeekView` component

7-day strip + grouped agenda (scrolls locally). Tap event → `onSelectEvent`.

**Files:**
- Create: `src/apps/calendar/WeekView.tsx`

- [ ] **Step 1: Implement**

```tsx
// src/apps/calendar/WeekView.tsx
import type { CalendarEvent } from '../../api/types';
import { weekDays, eventsForDay, groupEventsByDay, sameDay, type WeekStart } from './calendar-utils';
import BackChevron from './BackChevron';

interface WeekViewProps {
  focusDate: Date;
  now: Date;
  events: CalendarEvent[];
  weekStart: WeekStart;
  timeFormat: '24h' | '12h';
  offline: boolean;
  onBack: () => void;
  onSelectEvent: (e: CalendarEvent) => void;
}

const RED = '#E33030';
const COLORS = ['#4C9AFF', '#36B37E', '#B37FEB', '#FF8B00', '#00B8D9'];

function colorFor(e: CalendarEvent): string {
  if (!e.category) return '#8899AA';
  let h = 0;
  for (let i = 0; i < e.category.length; i++) h = (h * 31 + e.category.charCodeAt(i)) >>> 0;
  return COLORS[h % COLORS.length];
}

function fmtTime(iso: string, timeFormat: '24h' | '12h'): string {
  return new Date(iso).toLocaleTimeString('en-US', {
    hour: '2-digit', minute: '2-digit', hour12: timeFormat === '12h',
  });
}

export default function WeekView({
  focusDate, now, events, weekStart, timeFormat, offline, onBack, onSelectEvent,
}: WeekViewProps) {
  const days = weekDays(focusDate, weekStart);
  const groups = groupEventsByDay(events, days);
  const range = `${days[0].toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} – ${days[6].toLocaleDateString('en-US', { day: 'numeric' })}`;
  const dayInitials = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

  return (
    <div className="relative h-full w-full bg-black overflow-hidden">
      <BackChevron label={range} onBack={onBack} />

      {/* 7-day context strip */}
      <div className="absolute top-[15%] left-[14%] w-[72%] grid grid-cols-7 gap-[0.4vmin] text-center">
        {days.map((day) => {
          const isToday = sameDay(day, now);
          const has = eventsForDay(events, day).length > 0;
          return (
            <div key={day.toISOString()} className="relative pb-[1.2vmin]">
              <div className="text-white/40 text-[2vmin]">{dayInitials[day.getDay()]}</div>
              <div className="text-[2.6vmin]" style={{ color: isToday ? RED : '#fff', fontWeight: isToday ? 600 : 400 }}>
                {day.getDate()}
              </div>
              {has && (
                <span
                  className="absolute bottom-0 left-1/2 -translate-x-1/2 rounded-full"
                  style={{ width: '0.7vmin', height: '0.7vmin', background: isToday ? RED : '#fff' }}
                />
              )}
            </div>
          );
        })}
      </div>

      {/* Agenda */}
      <div className="absolute top-[31%] left-[15%] w-[70%] bottom-[12%] overflow-y-auto flex flex-col gap-[1vmin] calendar-scroll">
        {groups.length === 0 && (
          <p className="text-center text-white/40 text-[2.6vmin] mt-[6vmin]">
            {offline ? 'can’t reach calendar' : 'Nothing this week'}
          </p>
        )}
        {groups.map((g) => {
          const isToday = sameDay(g.day, now);
          const label = isToday
            ? `Today · ${g.day.toLocaleDateString('en-US', { weekday: 'short', day: 'numeric' })}`
            : g.day.toLocaleDateString('en-US', { weekday: 'short', day: 'numeric' });
          return (
            <div key={g.day.toISOString()} className="flex flex-col gap-[0.6vmin]">
              <div className="text-[2.2vmin] font-medium" style={{ color: isToday ? RED : 'rgba(255,255,255,0.55)' }}>
                {label}
              </div>
              {g.events.map((e) => (
                <button
                  key={e.uid}
                  onClick={() => onSelectEvent(e)}
                  className="flex items-center gap-[1.2vmin] bg-transparent border-0 text-left"
                >
                  <span className="rounded-full flex-none" style={{ width: '1.2vmin', height: '1.2vmin', background: colorFor(e) }} />
                  <span className="text-white/60 text-[2.2vmin] tabular-nums flex-none">
                    {e.allDay ? 'all day' : fmtTime(e.start, timeFormat)}
                  </span>
                  <span className="text-white text-[2.4vmin] truncate">{e.title}</span>
                </button>
              ))}
            </div>
          );
        })}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Add the local scroll opt-in**

The global CSS locks touch scrolling. Append to `src/index.css` (anywhere after the `@theme` block):

```css
.calendar-scroll {
  touch-action: pan-y;
  overflow-y: auto;
  scrollbar-width: none;
}
.calendar-scroll::-webkit-scrollbar { display: none; }
```

- [ ] **Step 3: Typecheck + commit**

Run: `npx tsc -b` → no errors.

```bash
git add src/apps/calendar/WeekView.tsx src/index.css
git commit -m "feat(calendar): WeekView strip + agenda with local scroll"
```

---

## Task 9: `DetailsView` component

**Files:**
- Create: `src/apps/calendar/DetailsView.tsx`

- [ ] **Step 1: Implement**

```tsx
// src/apps/calendar/DetailsView.tsx
import type { CalendarEvent } from '../../api/types';
import { relativeTime, sameDay } from './calendar-utils';
import BackChevron from './BackChevron';

interface DetailsViewProps {
  event: CalendarEvent;
  now: Date;
  timeFormat: '24h' | '12h';
  onBack: () => void;
}

const RED = '#E33030';
const COLORS = ['#4C9AFF', '#36B37E', '#B37FEB', '#FF8B00', '#00B8D9'];

function colorFor(e: CalendarEvent): string {
  if (!e.category) return '#8899AA';
  let h = 0;
  for (let i = 0; i < e.category.length; i++) h = (h * 31 + e.category.charCodeAt(i)) >>> 0;
  return COLORS[h % COLORS.length];
}

function fmtTime(iso: string, timeFormat: '24h' | '12h'): string {
  return new Date(iso).toLocaleTimeString('en-US', {
    hour: '2-digit', minute: '2-digit', hour12: timeFormat === '12h',
  });
}

export default function DetailsView({ event, now, timeFormat, onBack }: DetailsViewProps) {
  const start = new Date(event.start);
  const isToday = sameDay(start, now);
  const dateLine = isToday
    ? `Today · ${start.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}`
    : start.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
  const timeLine = event.allDay
    ? 'All day'
    : `${fmtTime(event.start, timeFormat)} – ${fmtTime(event.end, timeFormat)}`;

  return (
    <div className="relative h-full w-full bg-black overflow-hidden">
      <BackChevron onBack={onBack} />
      <div className="absolute inset-0 left-[16%] right-[16%] flex flex-col items-center justify-center text-center gap-[3vmin]">
        <span className="rounded-full" style={{ width: '2.4vmin', height: '2.4vmin', background: colorFor(event) }} />
        <div className="text-white font-medium text-[5vmin] leading-tight">{event.title}</div>
        <div className="font-medium text-[3.4vmin]" style={{ color: isToday ? RED : 'rgba(255,255,255,0.8)' }}>
          {dateLine}
        </div>
        <div className="text-white text-[4vmin]">{timeLine}</div>
        {event.location && (
          <div className="text-white/70 text-[3vmin]">{event.location}</div>
        )}
        {event.description && (
          <div className="text-white/50 text-[2.6vmin] leading-snug max-w-[95%]">{event.description}</div>
        )}
        {!event.allDay && (
          <div className="text-white/40 text-[2.4vmin]">{relativeTime(start, now)}</div>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Typecheck + commit**

Run: `npx tsc -b` → no errors.

```bash
git add src/apps/calendar/DetailsView.tsx
git commit -m "feat(calendar): DetailsView single-event read"
```

---

## Task 10: `CalendarApp` orchestrator (rewrite)

Owns `view`/`focusDate`/`selectedEvent`, registers the vertical-swipe callback (time navigation), computes the fetch range from the current view, renders the active view.

**Files:**
- Modify: `src/apps/calendar/CalendarApp.tsx` (full replacement)

- [ ] **Step 1: Replace the file**

```tsx
// src/apps/calendar/CalendarApp.tsx
import { useEffect, useMemo, useState } from 'react';
import type { AppProps } from '../../core/types';
import type { CalendarEvent } from '../../api/types';
import { useNavigation } from '../../core/navigation';
import { calendarAppSchema } from '../../shared/schemas/app.calendar';
import { useCalendarEvents } from './useCalendarEvents';
import { addDays, addMonths, monthWeeks, startOfWeek } from './calendar-utils';
import MonthView from './MonthView';
import WeekView from './WeekView';
import DetailsView from './DetailsView';

type View = 'month' | 'week' | 'details';

export default function CalendarApp({ isActive, config }: AppProps) {
  const cfg = useMemo(() => calendarAppSchema.parse(config ?? {}), [config]);
  const setVerticalSwipeCallback = useNavigation((s) => s.setVerticalSwipeCallback);

  const [now, setNow] = useState(() => new Date());
  const [view, setView] = useState<View>(cfg.defaultView);
  const [focusDate, setFocusDate] = useState(() => new Date());
  const [selected, setSelected] = useState<CalendarEvent | null>(null);

  // Roll `now` over roughly each minute so "today"/relative-time stay fresh.
  useEffect(() => {
    if (!isActive) return;
    const id = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(id);
  }, [isActive]);

  // Fetch range covers the visible month grid (month view is the widest need).
  const [fromIso, toIso] = useMemo(() => {
    const weeks = monthWeeks(focusDate, cfg.weekStart);
    const from = weeks[0][0];
    const to = addDays(weeks[weeks.length - 1][6], 1);
    return [from.toISOString(), to.toISOString()];
  }, [focusDate, cfg.weekStart]);

  const { events, offline } = useCalendarEvents(fromIso, toIso, isActive);

  // Vertical swipe = step through time at the current level.
  useEffect(() => {
    if (!isActive) {
      setVerticalSwipeCallback(null);
      return;
    }
    setVerticalSwipeCallback((dir) => {
      const delta = dir === 'up' ? 1 : -1; // up = forward in time
      setFocusDate((d) => (view === 'month' ? addMonths(d, delta) : addDays(d, delta * 7)));
    });
    return () => setVerticalSwipeCallback(null);
  }, [isActive, view, setVerticalSwipeCallback]);

  if (view === 'details' && selected) {
    return (
      <DetailsView
        event={selected}
        now={now}
        timeFormat={cfg.timeFormat}
        onBack={() => setView('week')}
      />
    );
  }

  if (view === 'week') {
    return (
      <WeekView
        focusDate={focusDate}
        now={now}
        events={events}
        weekStart={cfg.weekStart}
        timeFormat={cfg.timeFormat}
        offline={offline}
        onBack={() => setView('month')}
        onSelectEvent={(e) => {
          setSelected(e);
          setView('details');
        }}
      />
    );
  }

  return (
    <MonthView
      focusDate={focusDate}
      now={now}
      events={events}
      weekStart={cfg.weekStart}
      offline={offline}
      onSelectWeek={(day) => {
        setFocusDate(startOfWeek(day, cfg.weekStart));
        setView('week');
      }}
    />
  );
}
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc -b`
Expected: no errors. If TS flags `startOfWeek` unused in a view or a prop mismatch, reconcile against the signatures in Tasks 7–9.

- [ ] **Step 3: Run full test suite**

Run: `npm test`
Expected: PASS (utils, server, registry-coherence, navigation).

- [ ] **Step 4: Commit**

```bash
git add src/apps/calendar/CalendarApp.tsx
git commit -m "feat(calendar): three-view orchestrator with swipe time-nav"
```

---

## Task 11: Verify in the preview + polish

Round-display layout can only be judged visually. Drive the dev server and check each view.

**Files:** none (verification), plus any layout fixes discovered.

- [ ] **Step 1: Start the dev server**

Use the preview tool: `preview_start { name: "dev" }` (config in `.claude/launch.json`, port 5180). Navigate to `http://localhost:5180`.

- [ ] **Step 2: Open the Calendar app**

The kiosk is store-driven. In the browser console (or via `javascript_tool`): the app grid opens via swipe-down / 3-finger tap. Programmatically switch using the dev store: `window.__nav` is exposed. Set the active app to `calendar` (see how other apps are selected in `AppGrid.tsx`), or swipe horizontally to it.

- [ ] **Step 3: Verify each view inside the circle**

Resize the preview to a square (`resize_window { width: 800, height: 800 }`) to approximate the 1:1 round viewport. Check:
- **Month:** current week is enlarged/centered, other weeks fade, no numbers clipped at top/bottom, month label visible. Today is red.
- Tap a week → **Week:** strip shows 7 days + dots, agenda groups by day, today accented, back chevron visible. Scroll works if many events.
- Tap an event → **Details:** title/date/time/location/notes centered and legible, back chevron returns to Week.
- Vertical swipe (drag up/down in the preview) steps month/week in time.

Take a screenshot of each view with `computer { action: "screenshot" }`.

- [ ] **Step 4: Check console + fix any layout clipping**

`read_console_messages` — expect no errors. If any view clips against the circle, adjust the `left/right/top/bottom` percentages in that view component and re-check. Common fix: tighten the inscribed band (e.g. `left-[16%] right-[16%]`).

- [ ] **Step 5: Verify offline tell**

In the console: `javascript_tool` → temporarily block the endpoint (e.g. `window.fetch` returning a rejected promise) or stop the server; confirm Month/Week show "can’t reach calendar" and never blank/fake events. Restore.

- [ ] **Step 6: Final full check + commit any fixes**

Run: `npm test && npm run lint && npm run build`
Expected: all green; `dist/` builds (kiosk + admin + server bundle).

```bash
git add -A
git commit -m "fix(calendar): round-display layout polish from preview verification"
```

- [ ] **Step 7: Share a preview link + screenshots**

Provide the localhost URL and the per-view screenshots so the layout can be signed off (per project rule: always end with a viewable link).

---

## Self-Review

**Spec coverage:**
- §2.1 Month center-band → Task 7 ✓
- §2.2 Week strip+agenda + local scroll → Task 8 ✓
- §2.3 Details single event → Task 9 ✓
- §3 Navigation (tap drill, swipe time, back chevron) → Tasks 6, 10 ✓
- §4.1 `/api/calendar?from&to` + default window → Task 3 ✓
- §4.2 `CalendarEvent` richer fields → Task 2 ✓
- §4.3 client range fetch + cache + offline → Task 5 ✓
- §4.4 category-derived colors → Tasks 8, 9 (`colorFor`) ✓
- §5 config schema → Task 4 ✓
- §6 component structure → Tasks 6–10 ✓
- §7 edge cases (offline, empty, all-day, recurrence, backgrounded) → Tasks 2, 5, 8, 10, 11 ✓
- §8 testing (utils, server, registry, nav) → Tasks 1, 2, 4 ✓

**Placeholder scan:** No TBD/TODO; every code step shows full code. ✓

**Type consistency:** `WeekStart` type from `calendar-utils` used in all views; `colorFor`/`fmtTime` duplicated intentionally in Week+Details (small, local — acceptable DRY trade-off, or extract to `calendar-utils` if preferred during review); `useCalendarEvents(fromIso, toIso, enabled)` signature matches its Task-10 call; `setVerticalSwipeCallback` typed `((dir:'up'|'down')=>void)|null` matches [navigation.ts:28](../../../src/core/navigation.ts). ✓

**Note for implementer:** `colorFor`/`fmtTime` appear in both `WeekView` and `DetailsView`. If you'd rather not duplicate, lift both into `calendar-utils.ts` and import — functionally identical either way.
