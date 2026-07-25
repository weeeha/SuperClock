import { describe, it, expect } from 'vitest';
import { emptyStreak, toDateKey, toMonthKey, recordCompletion, settleMissedDays, HEARTS_PER_MONTH } from './streak';

const d = (y: number, m: number, day: number, h = 12) => new Date(y, m - 1, day, h);

describe('toDateKey', () => {
  // toISOString() would shift the key by a day in any UTC+ timezone —
  // the exact bug documented in HabitsApp.
  it('uses local calendar date, not UTC', () => {
    expect(toDateKey(new Date(2026, 6, 24, 23, 30))).toBe('2026-07-24');
    expect(toDateKey(new Date(2026, 6, 24, 0, 30))).toBe('2026-07-24');
  });

  it('zero-pads month and day', () => {
    expect(toDateKey(new Date(2026, 0, 5))).toBe('2026-01-05');
  });
});

describe('toMonthKey', () => {
  it('is year-month', () => {
    expect(toMonthKey(new Date(2026, 6, 24))).toBe('2026-07');
  });
});

describe('recordCompletion', () => {
  it('marks today done and is idempotent', () => {
    const once = recordCompletion(emptyStreak(), d(2026, 7, 24));
    const twice = recordCompletion(once, d(2026, 7, 24, 18));
    expect(twice.completions['2026-07-24']).toBe(true);
    expect(Object.keys(twice.completions)).toHaveLength(1);
  });

  it('sets lastCompletedKey', () => {
    expect(recordCompletion(emptyStreak(), d(2026, 7, 24)).lastCompletedKey).toBe('2026-07-24');
  });
});

describe('settleMissedDays', () => {
  it('is a no-op before the first ever workout', () => {
    const s = settleMissedDays(emptyStreak(), d(2026, 7, 24));
    expect(s.hearts).toBe(HEARTS_PER_MONTH);
  });

  it('costs nothing when yesterday was completed', () => {
    let s = recordCompletion(emptyStreak(), d(2026, 7, 23));
    s = settleMissedDays(s, d(2026, 7, 24));
    expect(s.hearts).toBe(HEARTS_PER_MONTH);
  });

  it('costs one heart per missed day', () => {
    let s = recordCompletion(emptyStreak(), d(2026, 7, 20));
    s = settleMissedDays(s, d(2026, 7, 23)); // missed 21st and 22nd
    expect(s.hearts).toBe(HEARTS_PER_MONTH - 2);
  });

  it('never drops below zero', () => {
    let s = recordCompletion(emptyStreak(), d(2026, 7, 1));
    s = settleMissedDays(s, d(2026, 7, 28));
    expect(s.hearts).toBe(0);
  });

  it('restores a full set of hearts on a new month', () => {
    let s = recordCompletion(emptyStreak(), d(2026, 7, 20));
    s = settleMissedDays(s, d(2026, 7, 25)); // burn some hearts
    expect(s.hearts).toBeLessThan(HEARTS_PER_MONTH);
    s = settleMissedDays(s, d(2026, 8, 1));
    expect(s.hearts).toBe(HEARTS_PER_MONTH);
    expect(s.monthKey).toBe('2026-08');
  });
});
