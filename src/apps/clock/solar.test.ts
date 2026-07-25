// NOAA solar maths. TZ pinned to UTC so expected values can be quoted
// straight from astronomical references without a conversion step.
process.env.TZ = 'UTC';

import { describe, it, expect } from 'vitest';
import { sunTimes } from './solar';

const TOL_MIN = 6; // NOAA simplified series is good to a few minutes

function minutes(h: number, m: number): number {
  return h * 60 + m;
}

describe('sunTimes', () => {
  it('Berlin, June solstice (reference: 02:43 / 19:33 UTC)', () => {
    const t = sunTimes(new Date(2026, 5, 21), 52.52, 13.405);
    expect(t.kind).toBe('normal');
    if (t.kind !== 'normal') return;
    expect(Math.abs(t.sunriseMin - minutes(2, 43))).toBeLessThanOrEqual(TOL_MIN);
    expect(Math.abs(t.sunsetMin - minutes(19, 33))).toBeLessThanOrEqual(TOL_MIN);
  });

  it('Sydney, June solstice (reference: 21:00 / 06:53 UTC)', () => {
    const t = sunTimes(new Date(2026, 5, 21), -33.87, 151.21);
    expect(t.kind).toBe('normal');
    if (t.kind !== 'normal') return;
    // Local sunrise 07:00 AEST = 21:00 UTC the previous evening; the
    // wrap-around is exactly what toLocal's modulo handles.
    expect(Math.abs(t.sunriseMin - minutes(21, 0))).toBeLessThanOrEqual(TOL_MIN);
    expect(Math.abs(t.sunsetMin - minutes(6, 53))).toBeLessThanOrEqual(TOL_MIN);
  });

  it('equator at lon 0 stays near 06:00 / 18:00 year-round', () => {
    for (const [y, mo, d] of [
      [2026, 0, 1],
      [2026, 3, 15],
      [2026, 6, 24],
      [2026, 9, 30],
    ] as const) {
      const t = sunTimes(new Date(y, mo, d), 0, 0);
      expect(t.kind).toBe('normal');
      if (t.kind !== 'normal') continue;
      expect(Math.abs(t.sunriseMin - minutes(6, 0))).toBeLessThanOrEqual(20);
      expect(Math.abs(t.sunsetMin - minutes(18, 0))).toBeLessThanOrEqual(20);
    }
  });

  it('Svalbard (78N): polar day in June, polar night in December', () => {
    expect(sunTimes(new Date(2026, 5, 21), 78, 15).kind).toBe('polar-day');
    expect(sunTimes(new Date(2026, 11, 21), 78, 15).kind).toBe('polar-night');
  });

  it('day length grows monotonically toward the June solstice (Berlin)', () => {
    const len = (mo: number, d: number) => {
      const t = sunTimes(new Date(2026, mo, d), 52.52, 13.405);
      if (t.kind !== 'normal') throw new Error('unexpected polar result');
      return (t.sunsetMin - t.sunriseMin + 1440) % 1440;
    };
    expect(len(0, 15)).toBeLessThan(len(2, 15));
    expect(len(2, 15)).toBeLessThan(len(4, 15));
    expect(len(4, 15)).toBeLessThan(len(5, 21));
  });
});
