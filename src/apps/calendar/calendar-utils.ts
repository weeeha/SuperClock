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
