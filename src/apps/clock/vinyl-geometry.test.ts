import { describe, it, expect } from 'vitest';
import { ARM, armReach, needlePoint, needleRadius } from './vinyl-geometry';

const dist = (a: { x: number; y: number }, b: { x: number; y: number }) => Math.hypot(a.x - b.x, a.y - b.y);

describe('needleRadius', () => {
  it('lands on the lead-in groove at :00 and reaches the run-out just before :60', () => {
    expect(needleRadius(0)).toBe(ARM.leadIn);
    expect(needleRadius(59.999)).toBeCloseTo(ARM.runOut, 1);
  });

  it('plays inward monotonically through the hour', () => {
    let last = needleRadius(0);
    for (let m = 1; m < 60; m++) {
      const r = needleRadius(m);
      expect(r).toBeLessThan(last);
      last = r;
    }
  });

  it('stays inside the groove band for every minute', () => {
    for (let m = 0; m < 60; m += 0.5) {
      const r = needleRadius(m);
      expect(r).toBeLessThanOrEqual(ARM.leadIn);
      expect(r).toBeGreaterThanOrEqual(ARM.runOut);
    }
  });
});

describe('needlePoint', () => {
  it('sits on the groove radius from the spindle and at arm length from the pivot', () => {
    for (const r of [ARM.leadIn, 300, 200, ARM.runOut]) {
      const p = needlePoint(r);
      expect(dist(p, { x: 500, y: 500 })).toBeCloseTo(r, 6);
      expect(dist(p, ARM.pivot)).toBeCloseTo(ARM.length, 6);
    }
  });

  it('puts the lead-in needle at the lower right of the record, where a deck headshell sits', () => {
    const p = needlePoint(ARM.leadIn);
    expect(p.x).toBeGreaterThan(500);
    expect(p.y).toBeGreaterThan(500);
  });

  it('keeps the needle inside the 1080 disc for every minute (the pivot may sit under the bezel, the needle may not)', () => {
    for (let m = 0; m < 60; m += 0.25) {
      expect(dist(needlePoint(needleRadius(m)), { x: 500, y: 500 })).toBeLessThanOrEqual(500);
    }
  });
});

describe('armReach', () => {
  it('covers the whole groove band, so no minute asks for a radius the arm cannot reach', () => {
    const { min, max } = armReach();
    expect(min).toBeLessThanOrEqual(ARM.runOut);
    expect(max).toBeGreaterThanOrEqual(ARM.leadIn);
  });

  it('pivots off the record like a deck, closer than the arm is long (the overhang that curves the needle track)', () => {
    const d = dist(ARM.pivot, { x: 500, y: 500 });
    expect(d).toBeGreaterThan(500);
    expect(ARM.length).toBeGreaterThan(d);
  });
});
