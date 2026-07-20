import { readdir } from 'node:fs/promises';
import ical, { type VEvent } from 'node-ical';
import type { CalendarEvent } from '../src/api/types';

const PHOTO_EXTENSIONS = new Set(['.jpg', '.jpeg', '.png', '.webp']);

function readSummary(value: VEvent['summary']): string {
  if (typeof value === 'string') return value;
  if (value && typeof value === 'object' && 'val' in value) return String(value.val);
  return '';
}

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
