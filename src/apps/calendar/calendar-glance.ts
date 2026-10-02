import type { CalendarEvent } from '../../api/types';
import { addDays, eventsForDay } from './calendar-utils';

/** Rows the Fields cover lists under the lead event. */
const MAX_REST = 2;

/** What the Fields-skin cover leads with, from the events it already holds.
 *  - now:  an event is on; it leads, with the next ones after it.
 *  - next: nothing is on; the next event today leads.
 *  - done: nothing else timed today; tomorrow's first event, if any.
 *  All-day events never lead: they ride along in `allDay`. */
export type CalendarGlance =
  | { kind: 'now' | 'next'; event: CalendarEvent; rest: CalendarEvent[]; allDay: CalendarEvent[] }
  | { kind: 'done'; tomorrow: CalendarEvent | null; allDay: CalendarEvent[] };

const startMs = (e: CalendarEvent) => new Date(e.start).getTime();
const byStart = (a: CalendarEvent, b: CalendarEvent) => startMs(a) - startMs(b);

export function calendarGlance(events: CalendarEvent[], now: Date): CalendarGlance {
  const today = eventsForDay(events, now);
  const allDay = today.filter((e) => e.allDay);
  const timed = today.filter((e) => !e.allDay).sort(byStart);
  const t = now.getTime();

  const onNow = timed.find((e) => startMs(e) <= t && t < new Date(e.end).getTime());
  if (onNow) {
    const rest = timed.filter((e) => startMs(e) > startMs(onNow)).slice(0, MAX_REST);
    return { kind: 'now', event: onNow, rest, allDay };
  }

  const next = timed.find((e) => startMs(e) > t);
  if (next) {
    const rest = timed.filter((e) => startMs(e) > startMs(next)).slice(0, MAX_REST);
    return { kind: 'next', event: next, rest, allDay };
  }

  const tomorrowEvents = eventsForDay(events, addDays(now, 1));
  const tomorrow =
    tomorrowEvents.filter((e) => !e.allDay).sort(byStart)[0] ??
    tomorrowEvents.filter((e) => e.allDay)[0] ??
    null;
  return { kind: 'done', tomorrow, allDay };
}
