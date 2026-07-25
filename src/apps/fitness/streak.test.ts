import { describe, it, expect } from 'vitest';
import { emptyStreak, toDateKey, toMonthKey, recordCompletion, settleMissedDays, HEARTS_PER_MONTH } from './streak';
import type { StreakState } from './streak';

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

  // settleMissedDays runs at mount and on every day-rollover tick, so a
  // second call for the same `now` must not re-charge a gap it already
  // accounted for.
  it('is idempotent when re-run for the same day', () => {
    const s = recordCompletion(emptyStreak(), d(2026, 7, 20));
    const now = d(2026, 7, 25);
    const once = settleMissedDays(s, now);
    const twice = settleMissedDays(once, now);
    const thrice = settleMissedDays(twice, now);
    expect(once.hearts).toBe(twice.hearts);
    expect(twice.hearts).toBe(thrice.hearts);
  });

  it('month rollover does not self-undo when re-settled the same day', () => {
    const s = recordCompletion(emptyStreak(), d(2026, 7, 30));
    const now = d(2026, 8, 10);
    const first = settleMissedDays(s, now);
    expect(first.hearts).toBe(HEARTS_PER_MONTH);
    const second = settleMissedDays(first, now);
    expect(second.hearts).toBe(HEARTS_PER_MONTH);
  });

  it('charges each day exactly once across successive settle calls', () => {
    let s = recordCompletion(emptyStreak(), d(2026, 7, 1));
    s = settleMissedDays(s, d(2026, 7, 3)); // charges day 2 only
    expect(s.hearts).toBe(HEARTS_PER_MONTH - 1);
    s = settleMissedDays(s, d(2026, 7, 4)); // charges day 3 only
    expect(s.hearts).toBe(HEARTS_PER_MONTH - 2);
  });

  it('does not charge for days that were actually completed', () => {
    // Constructed directly: reaching this via recordCompletion would require
    // two completions with no settle between them, which the day-rollover
    // tick makes unreachable.
    const s: StreakState = {
      completions: { '2026-07-01': true, '2026-07-03': true },
      lastCompletedKey: '2026-07-03',
      settledThroughKey: '2026-07-01',
      hearts: HEARTS_PER_MONTH,
      monthKey: '2026-07',
    };
    // Window [2026-07-01, 2026-07-05): days 1 and 3 completed, days 2 and 4 missed.
    const settled = settleMissedDays(s, d(2026, 7, 5));
    expect(settled.hearts).toBe(HEARTS_PER_MONTH - 2);
    expect(settled.settledThroughKey).toBe('2026-07-05');
  });
});
