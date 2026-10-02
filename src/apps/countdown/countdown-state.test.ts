import { describe, it, expect } from 'vitest';
import { countdownState, localToday, msUntilNextLocalMidnight, parseDate } from './countdown-state';
import { countdownAppSchema } from '../../shared/schemas/app.countdown';

const cfg = (over: Record<string, unknown>) => countdownAppSchema.parse(over);
const day = (s: string) => parseDate(s)!;

describe('parseDate', () => {
  it('accepts a real calendar date', () => {
    expect(parseDate('2027-03-10')).toEqual({ y: 2027, m: 3, d: 10 });
  });
  it.each(['', '2027-3-10', '2027-02-30', '2027-13-01', '0050-01-01', 'tomorrow'])('rejects %j', (s) => {
    expect(parseDate(s)).toBeNull();
  });
});

describe('countdownState', () => {
  it('is not set up without a valid target date', () => {
    expect(countdownState(day('2026-10-01'), cfg({}))).toEqual({ kind: 'not-set-up' });
    expect(countdownState(day('2026-10-01'), cfg({ targetDate: '2026-02-30' }))).toEqual({ kind: 'not-set-up' });
  });

  it('counts days until', () => {
    expect(countdownState(day('2026-08-08'), cfg({ targetDate: '2027-03-10' }))).toEqual({
      kind: 'until', unit: 'days', value: 214, remainderDays: 0, ring: null,
    });
  });

  it('counts one day until', () => {
    expect(countdownState(day('2027-03-09'), cfg({ targetDate: '2027-03-10' }))).toMatchObject({ kind: 'until', value: 1 });
  });

  it('is today on the date', () => {
    expect(countdownState(day('2027-03-10'), cfg({ targetDate: '2027-03-10' }))).toEqual({ kind: 'today', ring: null });
  });

  it('counts up after the date', () => {
    expect(countdownState(day('2027-03-22'), cfg({ targetDate: '2027-03-10' }))).toEqual({
      kind: 'since', unit: 'days', value: 12, remainderDays: 0, ring: null,
    });
    expect(countdownState(day('2027-03-11'), cfg({ targetDate: '2027-03-10' }))).toMatchObject({ kind: 'since', value: 1 });
  });

  it('splits weeks and remainder days in the weeks style', () => {
    const c = cfg({ targetDate: '2027-03-10', style: 'weeks' });
    expect(countdownState(day('2026-08-08'), c)).toMatchObject({ unit: 'weeks', value: 30, remainderDays: 4 });
    expect(countdownState(day('2027-02-24'), c)).toMatchObject({ unit: 'weeks', value: 2, remainderDays: 0 });
    expect(countdownState(day('2027-03-03'), c)).toMatchObject({ unit: 'weeks', value: 1, remainderDays: 0 });
    expect(countdownState(day('2027-03-17'), c)).toMatchObject({ kind: 'since', unit: 'weeks', value: 1, remainderDays: 0 });
  });

  it('forces weeks at 10 000 days or more', () => {
    expect(countdownState(day('2026-01-01'), cfg({ targetDate: '2053-05-19' }))).toMatchObject({ unit: 'weeks', value: 1428, remainderDays: 4 });
    expect(countdownState(day('2026-01-01'), cfg({ targetDate: '2053-05-18' }))).toMatchObject({ unit: 'days', value: 9999 });
  });

  it('does not lose or gain a day across DST changes (calendar dates, not milliseconds)', () => {
    // US spring-forward 2027-03-14 and fall-back 2026-11-01.
    expect(countdownState(day('2027-03-13'), cfg({ targetDate: '2027-03-15' }))).toMatchObject({ value: 2 });
    expect(countdownState(day('2026-10-31'), cfg({ targetDate: '2026-11-02' }))).toMatchObject({ value: 2 });
  });

  describe('progress ring', () => {
    const ring = (today: string, over: Record<string, unknown>) =>
      (countdownState(day(today), cfg({ style: 'progress-ring', targetDate: '2027-01-11', ...over })) as { ring: unknown }).ring;

    it('is the elapsed share between start and target', () => {
      expect(ring('2027-01-01', { startDate: '2027-01-01' })).toEqual({ fraction: 0, spent: false });
      expect(ring('2027-01-06', { startDate: '2027-01-01' })).toEqual({ fraction: 0.5, spent: false });
    });

    it('clamps to 0 before the start date', () => {
      expect(ring('2026-12-01', { startDate: '2027-01-01' })).toEqual({ fraction: 0, spent: false });
    });

    it('is spent (full, no accent) on and after the date', () => {
      expect(ring('2027-01-11', { startDate: '2027-01-01' })).toEqual({ fraction: 1, spent: true });
      expect(ring('2027-02-01', {})).toEqual({ fraction: 1, spent: true });
    });

    it.each(['', '2027-02-30', '2027-01-11', '2027-02-01'])('reports a missing start for %j', (startDate) => {
      expect(ring('2027-01-05', { startDate })).toEqual({ missingStart: true });
    });

    it('is null for the other styles', () => {
      expect(ring('2027-01-05', { style: 'days', startDate: '2027-01-01' })).toBeNull();
    });
  });
});

describe('localToday', () => {
  it('reads the local calendar date', () => {
    expect(localToday(new Date(2027, 2, 10, 23, 59))).toEqual({ y: 2027, m: 3, d: 10 });
  });
});

describe('msUntilNextLocalMidnight', () => {
  // Property over a whole year in the host time zone. On a host with DST
  // (Nick's Mac: America/New_York) this crosses both transitions.
  it('always lands exactly on the next local midnight', () => {
    for (let i = 0; i < 366; i++) {
      for (const [h, min] of [[0, 0], [12, 0], [23, 59]]) {
        const now = new Date(2026, 0, 1 + i, h, min, 30);
        const at = new Date(now.getTime() + msUntilNextLocalMidnight(now));
        expect([at.getHours(), at.getMinutes(), at.getSeconds()]).toEqual([0, 0, 0]);
        expect(at.getDate()).toBe(new Date(2026, 0, 2 + i).getDate());
      }
    }
  });
});
