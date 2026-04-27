import { readdir } from 'node:fs/promises';
import ical, { type VEvent } from 'node-ical';
import type { CalendarEvent } from '../src/api/types';

const PHOTO_EXTENSIONS = new Set(['.jpg', '.jpeg', '.png', '.webp']);
const ONE_DAY_MS = 24 * 60 * 60 * 1000;

function readSummary(value: VEvent['summary']): string {
  if (typeof value === 'string') return value;
  if (value && typeof value === 'object' && 'val' in value) return String(value.val);
  return '';
}

function toEvent(start: Date, end: Date, title: string, allDay: boolean): CalendarEvent {
  return {
    start: start.toISOString(),
    end: end.toISOString(),
    title,
    allDay,
  };
}

export async function getCalendarEvents(icsUrl: string): Promise<CalendarEvent[]> {
  if (!icsUrl) return [];

  try {
    const data = await ical.async.fromURL(icsUrl);
    const now = new Date();
    const horizon = new Date(now.getTime() + ONE_DAY_MS);
    const events: CalendarEvent[] = [];

    for (const key of Object.keys(data)) {
      const item = data[key];
      if (!item || item.type !== 'VEVENT') continue;
      const event = item as VEvent;

      const title = readSummary(event.summary).trim();
      if (!title) continue;
      const allDay = event.datetype === 'date';

      if (event.rrule) {
        const occurrences = event.rrule.between(now, horizon, true);
        const durationMs =
          event.end && event.start
            ? new Date(event.end as Date).getTime() - new Date(event.start as Date).getTime()
            : 0;
        for (const occurrenceStart of occurrences) {
          const occurrenceEnd = new Date(occurrenceStart.getTime() + durationMs);
          events.push(toEvent(occurrenceStart, occurrenceEnd, title, allDay));
        }
        continue;
      }

      const start = event.start ? new Date(event.start as Date) : null;
      const end = event.end ? new Date(event.end as Date) : null;
      if (!start) continue;

      if (start >= horizon) continue;
      if (end && end < now) continue;
      if (!end && start < now) continue;

      events.push(toEvent(start, end ?? start, title, allDay));
    }

    events.sort((a, b) => a.start.localeCompare(b.start));
    return events;
  } catch (err) {
    console.warn('[api] getCalendarEvents failed:', (err as Error).message);
    return [];
  }
}

export async function listPhotos(photosDir: string): Promise<string[]> {
  try {
    const entries = await readdir(photosDir, { withFileTypes: true });
    return entries
      .filter((e) => e.isFile())
      .map((e) => e.name)
      .filter((name) => {
        const dot = name.lastIndexOf('.');
        if (dot < 0) return false;
        return PHOTO_EXTENSIONS.has(name.slice(dot).toLowerCase());
      })
      .sort();
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code !== 'ENOENT') {
      console.warn('[api] listPhotos failed:', (err as Error).message);
    }
    return [];
  }
}
