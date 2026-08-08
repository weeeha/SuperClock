import type { CalendarEvent } from '../../api/types';

export type WeekStart = 'monday' | 'sunday';

/** The calendar drill stack above the zoom ladder: a day agenda, or a single
 *  event's details opened from that day. `null` = resting on the ladder. */
export type Drill =
  | { kind: 'day'; day: Date }
  | { kind: 'details'; day: Date; event: CalendarEvent };

/** Pop one level of the drill stack: details → day → resting (null).
 *  Idempotent at the surface — a no-op when already resting. Single source of
 *  the "go up one level" walk shared by swipe-down and the system back gesture. */
export function popDrill(drill: Drill | null): Drill | null {
  if (!drill) return null;
  return drill.kind === 'details' ? { kind: 'day', day: drill.day } : null;
}

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
  r.setDate(1);
  r.setMonth(r.getMonth() + n);
  const lastDay = new Date(r.getFullYear(), r.getMonth() + 1, 0).getDate();
  r.setDate(Math.min(d.getDate(), lastDay));
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
  while (cursor <= last || weeks.length === 0) {
    weeks.push(Array.from({ length: 7 }, (_, i) => addDays(cursor, i)));
    cursor = addDays(cursor, 7);
    if (weeks.length >= 6) break; // safety
  }
  return weeks;
}

export function eventsForDay(events: CalendarEvent[], day: Date): CalendarEvent[] {
  const d = atMidnight(day).getTime();
  return events.filter((e) => {
    const start = new Date(e.start);
    let end = new Date(e.end);
    // All-day events carry an exclusive DTEND (next midnight); step back 1ms so a
    // single all-day event doesn't leak into the following day.
    if (e.allDay && end.getTime() > start.getTime()) {
      end = new Date(end.getTime() - 1);
    }
    const startKey = atMidnight(start).getTime();
    const endKey = Math.max(startKey, atMidnight(end).getTime()); // always cover the start day
    return d >= startKey && d <= endKey;
  });
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
      return new Date(a.start).getTime() - new Date(b.start).getTime();
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

/** Local calendar-day key, e.g. "2026-7-24". Stable across DST; never UTC-shifted. */
export function dayKey(d: Date): string {
  return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
}

/** Set of local day keys covered by any event (multi-day spans expanded,
 *  all-day exclusive DTEND respected). One pass over events — cheap enough
 *  to memo once per fetch for the year heat-ring. */
export function eventDayKeys(events: CalendarEvent[]): Set<string> {
  const keys = new Set<string>();
  for (const e of events) {
    const start = new Date(e.start);
    let end = new Date(e.end);
    if (e.allDay && end.getTime() > start.getTime()) {
      end = new Date(end.getTime() - 1); // exclusive DTEND → last covered day
    }
    let cursor = atMidnight(start);
    const stopMs = Math.max(cursor.getTime(), atMidnight(end).getTime());
    for (let i = 0; cursor.getTime() <= stopMs && i < 400; i++) {
      keys.add(dayKey(cursor));
      cursor = addDays(cursor, 1);
    }
  }
  return keys;
}

/** "in 3h 12m" / "in 45m" when target is in the future and within `withinHours`;
 *  otherwise null (caller falls back to the absolute time range). */
export function countdownLabel(target: Date, now: Date, withinHours = 12): string | null {
  const diffMs = target.getTime() - now.getTime();
  if (diffMs <= 0 || diffMs > withinHours * 3_600_000) return null;
  const totalMin = Math.ceil(diffMs / 60_000);
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  return h > 0 ? `in ${h}h ${m}m` : `in ${m}m`;
}

export function relativeTime(target: Date, now: Date): string {
  const diffMs = target.getTime() - now.getTime();
  if (Math.abs(diffMs) < 60000) return 'now';
  const absMin = Math.round(Math.abs(diffMs) / 60000);
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
