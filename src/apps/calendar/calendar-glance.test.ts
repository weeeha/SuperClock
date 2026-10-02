import { describe, it, expect } from 'vitest';
import { calendarGlance } from './calendar-glance';
import type { CalendarEvent } from '../../api/types';

// Local wall-clock times on Thursday 1 October 2026.
const at = (h: number, m = 0, day = 1) => new Date(2026, 9, day, h, m).toISOString();
const ev = (title: string, s: [number, number], e: [number, number], day = 1): CalendarEvent => ({
  uid: title, title, allDay: false, start: at(s[0], s[1], day), end: at(e[0], e[1], day),
});
const allDay = (title: string, day = 1): CalendarEvent => ({
  uid: title, title, allDay: true,
  start: new Date(2026, 9, day).toISOString(), end: new Date(2026, 9, day + 1).toISOString(),
});

const DAY = [
  ev('Standup', [9, 0], [10, 0]),
  ev('Lunch', [12, 30], [13, 30]),
  ev('Design review', [15, 30], [16, 30]),
  ev('Gym', [18, 0], [19, 0]),
  ev('Dinner', [19, 30], [21, 0]),
];
const NOW = new Date(2026, 9, 1, 14, 0);

describe('calendarGlance', () => {
  it('leads with the next event and lists what follows it today', () => {
    const g = calendarGlance(DAY, NOW);
    expect(g.kind).toBe('next');
    if (g.kind !== 'next') return;
    expect(g.event.title).toBe('Design review');
    expect(g.rest.map((e) => e.title)).toEqual(['Gym', 'Dinner']);
  });

  it('leads with an event that is on right now', () => {
    const g = calendarGlance(DAY, new Date(2026, 9, 1, 12, 45));
    expect(g.kind).toBe('now');
    if (g.kind !== 'now') return;
    expect(g.event.title).toBe('Lunch');
    expect(g.rest.map((e) => e.title)).toEqual(['Design review', 'Gym']); // at most two
  });

  it('keeps the list to two rows', () => {
    const g = calendarGlance(DAY, new Date(2026, 9, 1, 8, 0));
    expect(g.kind === 'next' && g.rest).toHaveLength(2);
  });

  it('reports the all-day events of today on the side, never as the hero', () => {
    const g = calendarGlance([allDay('Holiday'), ...DAY], NOW);
    expect(g.kind === 'next' && g.event.title).toBe('Design review');
    expect(g.allDay.map((e) => e.title)).toEqual(['Holiday']);
  });

  it('says nothing else is on today and names tomorrow’s first event', () => {
    const tomorrow = [ev('Standup', [9, 0], [10, 0], 2), ev('Planning', [11, 0], [12, 0], 2)];
    const g = calendarGlance([...DAY, ...tomorrow], new Date(2026, 9, 1, 22, 0));
    expect(g.kind).toBe('done');
    if (g.kind !== 'done') return;
    expect(g.tomorrow?.title).toBe('Standup');
  });

  it('has no tomorrow when tomorrow is empty', () => {
    const g = calendarGlance(DAY, new Date(2026, 9, 1, 22, 0));
    expect(g.kind === 'done' && g.tomorrow).toBeNull();
  });

  it('treats an empty calendar as a finished day', () => {
    expect(calendarGlance([], NOW)).toEqual({ kind: 'done', tomorrow: null, allDay: [] });
  });

  it('orders by start time whatever order the feed sends', () => {
    const g = calendarGlance([...DAY].reverse(), NOW);
    expect(g.kind === 'next' && g.event.title).toBe('Design review');
  });
});
