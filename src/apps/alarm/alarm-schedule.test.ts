import { describe, it, expect } from 'vitest';
import {
  clockText, daysLabel, nextAlarm, nextLabel, nextOccurrence, stepTime, untilLabel,
} from './alarm-schedule';

const alarm = (time: string, days: number[], enabled = true) => ({ id: 'a', time, days, enabled });
// Friday 2 October 2026, 22:38 local.
const fri = new Date(2026, 9, 2, 22, 38);

describe('nextOccurrence', () => {
  it('rings a once-alarm today if still ahead, else tomorrow', () => {
    expect(nextOccurrence(alarm('23:00', []), fri)).toBe(new Date(2026, 9, 2, 23, 0).getTime());
    expect(nextOccurrence(alarm('07:10', []), fri)).toBe(new Date(2026, 9, 3, 7, 10).getTime());
  });
  it('skips to the next allowed weekday', () => {
    expect(nextOccurrence(alarm('07:10', [1, 2, 3, 4, 5]), fri)).toBe(new Date(2026, 9, 5, 7, 10).getTime());
    expect(nextOccurrence(alarm('07:10', [6]), fri)).toBe(new Date(2026, 9, 3, 7, 10).getTime());
  });
  it('is null when disabled', () => {
    expect(nextOccurrence(alarm('07:10', [], false), fri)).toBeNull();
  });
  it('always lands on the stated local time across a whole year (both DST changes on a DST host)', () => {
    for (let i = 0; i < 366; i++) {
      const now = new Date(2026, 0, 1 + i, 12, 0);
      const at = new Date(nextOccurrence(alarm('07:10', [0, 1, 2, 3, 4, 5, 6]), now)!);
      expect([at.getHours(), at.getMinutes()]).toEqual([7, 10]);
      expect(at.getDate()).toBe(new Date(2026, 0, 2 + i).getDate());
    }
  });
});

describe('labels', () => {
  it('names the days', () => {
    expect(daysLabel([])).toBe('Once');
    expect(daysLabel([0, 1, 2, 3, 4, 5, 6])).toBe('Every day');
    expect(daysLabel([5, 4, 3, 2, 1])).toBe('Weekdays');
    expect(daysLabel([6, 0])).toBe('Weekends');
    expect(daysLabel([3, 1])).toBe('Mon, Wed');
  });
  it('counts down in days, hours and minutes', () => {
    expect(untilLabel((8 * 60 + 32) * 60_000)).toBe('in 8h 32m');
    expect(untilLabel(32 * 60_000)).toBe('in 32m');
    expect(untilLabel(5_000)).toBe('in 1m');
    expect(untilLabel((27 * 60 + 5) * 60_000)).toBe('in 1d 3h');
  });
  it('says when the next alarm is', () => {
    expect(nextLabel(new Date(2026, 9, 2, 23, 0).getTime(), fri)).toBe('today 23:00');
    expect(nextLabel(new Date(2026, 9, 3, 7, 10).getTime(), fri)).toBe('tomorrow 07:10');
    expect(nextLabel(new Date(2026, 9, 6, 7, 10).getTime(), fri)).toBe('Tue 07:10');
  });
  it('formats a wall-clock time', () => {
    expect(clockText(new Date(2026, 9, 2, 6, 58).getTime())).toBe('06:58');
  });
});

describe('stepTime', () => {
  it('steps minutes by 5 and hours by 1, wrapping', () => {
    expect(stepTime('07:10', 'minutes', 1)).toBe('07:15');
    expect(stepTime('07:55', 'minutes', 1)).toBe('07:00');
    expect(stepTime('07:00', 'minutes', -1)).toBe('07:55');
    expect(stepTime('23:10', 'hours', 1)).toBe('00:10');
    expect(stepTime('00:10', 'hours', -2)).toBe('22:10');
  });
});

describe('nextAlarm', () => {
  it('is the enabled alarm that rings soonest', () => {
    const a = { id: 'a', time: '07:10', days: [], enabled: true };
    const b = { id: 'b', time: '23:00', days: [], enabled: true };
    const c = { id: 'c', time: '22:45', days: [], enabled: false };
    expect(nextAlarm([a, b, c], fri)?.alarm.id).toBe('b');
    expect(nextAlarm([c], fri)).toBeNull();
  });
});
