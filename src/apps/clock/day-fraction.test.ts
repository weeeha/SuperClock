// Depletion-face day arithmetic. TZ is pinned to Europe/Berlin because the
// DST cases need a zone that actually observes it (2026: spring-forward
// Mar 29, autumn-back Oct 25).
process.env.TZ = 'Europe/Berlin';

import { describe, it, expect } from 'vitest';
import { calendarDayState, awakeState, wedgePath } from './day-fraction';

describe('calendarDayState', () => {
  it('00:00 is a full disc, not an empty one', () => {
    const s = calendarDayState(new Date(2026, 6, 24, 0, 0, 0));
    expect(s.remaining).toBe(1);
    expect(s.boundaryDeg).toBe(0);
    expect(s.minutesLeft).toBe(1440);
    expect(s.asleep).toBe(false);
  });

  it('23:59 is a one-minute sliver', () => {
    const s = calendarDayState(new Date(2026, 6, 24, 23, 59, 0));
    expect(s.minutesLeft).toBe(1);
    expect(s.remaining).toBeCloseTo(1 / 1440, 6);
    expect(s.boundaryDeg).toBeCloseTo(360 - 0.25, 3);
  });

  it('noon is exactly half on a normal day', () => {
    const s = calendarDayState(new Date(2026, 6, 24, 12, 0, 0));
    expect(s.remaining).toBeCloseTo(0.5, 9);
    expect(s.boundaryDeg).toBeCloseTo(180, 6);
  });

  it('spring-forward day (23h) still empties at local midnight', () => {
    // 2026-03-29 in Berlin: 02:00→03:00 skipped, day is 23 real hours.
    const oneMinLeft = calendarDayState(new Date(2026, 2, 29, 23, 59, 0));
    expect(oneMinLeft.minutesLeft).toBe(1);
    // Wall-clock noon is NOT the halfway point of a 23-hour day: 12h of
    // wall clock remain but only 11h have elapsed.
    const noon = calendarDayState(new Date(2026, 2, 29, 12, 0, 0));
    expect(noon.remaining).toBeCloseTo(12 / 23, 6);
  });

  it('autumn-back day (25h) still empties at local midnight', () => {
    // 2026-10-25 in Berlin: 03:00→02:00 repeated, day is 25 real hours.
    const oneMinLeft = calendarDayState(new Date(2026, 9, 25, 23, 59, 0));
    expect(oneMinLeft.minutesLeft).toBe(1);
    const noon = calendarDayState(new Date(2026, 9, 25, 12, 0, 0));
    expect(noon.remaining).toBeCloseTo(12 / 25, 6);
  });
});

describe('awakeState', () => {
  const night = { start: '22:00', end: '07:00' };

  it('mid-awake: fraction spans wake to sleep', () => {
    // 07:00 wake, 22:00 sleep -> 15h cycle. At 14:30, 7.5h remain.
    const s = awakeState(new Date(2026, 6, 24, 14, 30, 0), night);
    expect(s.asleep).toBe(false);
    expect(s.remaining).toBeCloseTo(7.5 / 15, 6);
    expect(s.minutesLeft).toBe(450);
  });

  it('inside the night window: spent disc, countdown to wake', () => {
    const s = awakeState(new Date(2026, 6, 24, 23, 30, 0), night);
    expect(s.asleep).toBe(true);
    expect(s.remaining).toBe(0);
    expect(s.boundaryDeg).toBe(360);
    expect(s.minutesLeft).toBe(7 * 60 + 30); // 23:30 -> 07:00
  });

  it('early-morning inside a midnight-crossing window counts to the same-day wake', () => {
    const s = awakeState(new Date(2026, 6, 24, 6, 0, 0), night);
    expect(s.asleep).toBe(true);
    expect(s.minutesLeft).toBe(60);
  });

  it('no window falls back to calendar day', () => {
    const now = new Date(2026, 6, 24, 12, 0, 0);
    expect(awakeState(now, undefined)).toEqual(calendarDayState(now));
  });

  it('malformed window falls back to calendar day', () => {
    const now = new Date(2026, 6, 24, 12, 0, 0);
    expect(awakeState(now, { start: 'nope', end: '07:00' })).toEqual(calendarDayState(now));
  });

  it('non-crossing window (13:00-14:00 nap) still works', () => {
    const nap = { start: '13:00', end: '14:00' };
    const during = awakeState(new Date(2026, 6, 24, 13, 30, 0), nap);
    expect(during.asleep).toBe(true);
    expect(during.minutesLeft).toBe(30);
    // 15:00: cycle is 14:00 today -> 13:00 tomorrow (23h). 22h remain.
    const after = awakeState(new Date(2026, 6, 24, 15, 0, 0), nap);
    expect(after.asleep).toBe(false);
    expect(after.remaining).toBeCloseTo(22 / 23, 6);
  });
});

describe('wedgePath', () => {
  it('a full sweep produces a closed two-arc circle, not a degenerate arc', () => {
    const p = wedgePath(500, 500, 430, 0, 360);
    expect(p).toContain('A 430 430 0 1 1');
    expect((p.match(/A /g) ?? []).length).toBe(2);
  });

  it('a sliver stays a simple wedge', () => {
    const p = wedgePath(500, 500, 430, 359, 360);
    expect((p.match(/A /g) ?? []).length).toBe(1);
    expect(p.startsWith('M 500 500 L')).toBe(true);
  });

  it('uses the large-arc flag past 180 degrees', () => {
    expect(wedgePath(500, 500, 430, 0, 270)).toContain('A 430 430 0 1 1');
    expect(wedgePath(500, 500, 430, 0, 90)).toContain('A 430 430 0 0 1');
  });
});
