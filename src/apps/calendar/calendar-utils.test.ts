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
  it('addMonths clamps to end of shorter target month (Jan 31 → Feb 28)', () => {
    expect(addMonths(new Date(2026, 0, 31, 9, 0), 1)).toEqual(new Date(2026, 1, 28, 9, 0));
  });
  it('addMonths back a month also clamps (Mar 31 → Feb 28)', () => {
    expect(addMonths(new Date(2026, 2, 31), -1)).toEqual(new Date(2026, 1, 28));
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
  it('includes a multi-day all-day event on every spanned day (exclusive DTEND)', () => {
    // Tue Jul 14 → DTEND Fri Jul 17 (exclusive) = covers Tue/Wed/Thu
    const trip = ev({ uid: 'trip', allDay: true, title: 'Trip',
      start: new Date(2026, 6, 14).toISOString(), end: new Date(2026, 6, 17).toISOString() });
    expect(eventsForDay([trip], new Date(2026, 6, 13))).toHaveLength(0); // Mon before
    expect(eventsForDay([trip], new Date(2026, 6, 14))).toHaveLength(1); // Tue
    expect(eventsForDay([trip], new Date(2026, 6, 16))).toHaveLength(1); // Thu
    expect(eventsForDay([trip], new Date(2026, 6, 17))).toHaveLength(0); // Fri (DTEND exclusive)
  });
  it('still matches a zero-duration all-day event on its own day only', () => {
    const conf = ev({ uid: 'c', allDay: true, title: 'Conf',
      start: new Date(2026, 6, 16).toISOString(), end: new Date(2026, 6, 16).toISOString() });
    expect(eventsForDay([conf], new Date(2026, 6, 16))).toHaveLength(1);
    expect(eventsForDay([conf], new Date(2026, 6, 17))).toHaveLength(0);
  });
  it('includes a multi-day timed event across its span', () => {
    const e = ev({ start: new Date(2026, 6, 14, 10).toISOString(), end: new Date(2026, 6, 16, 15).toISOString() });
    expect(eventsForDay([e], new Date(2026, 6, 15))).toHaveLength(1); // middle day
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
  it('is exclusive at the boundaries (touching ranges do not overlap)', () => {
    const e = ev({ start: new Date(2026, 6, 19, 10).toISOString(), end: new Date(2026, 6, 19, 12).toISOString() });
    expect(overlapsRange(e, new Date(2026, 6, 19, 12), new Date(2026, 6, 19, 14))).toBe(false);
    expect(overlapsRange(e, new Date(2026, 6, 19, 8), new Date(2026, 6, 19, 10))).toBe(false);
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
