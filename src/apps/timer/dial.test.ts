import { describe, it, expect } from 'vitest';
import { RING_FRACTION } from '../../core/gesture-zones';
import {
  angleFrom12, bandCircle, degreesToMs, inBand, MAX_MS, MIN_MS, msToDegrees, snapClamp, unwrapDelta,
} from './dial';

describe('dial', () => {
  it('snaps to 30 s and clamps to 0:30 … 60:00', () => {
    expect(snapClamp(100_000)).toBe(90_000);
    expect(snapClamp(106_000)).toBe(120_000);
    expect(snapClamp(0)).toBe(MIN_MS);
    expect(snapClamp(99 * 60_000)).toBe(MAX_MS);
  });
  it('classifies the band: 60% of the radius to the arc ring', () => {
    const W = 1000, H = 1000, R = 500;
    expect(inBand(500, 500 - R * 0.59, W, H)).toBe(false);
    expect(inBand(500, 500 - R * 0.61, W, H)).toBe(true);
    expect(inBand(500, 500 - R * (1 - RING_FRACTION) + 1, W, H)).toBe(true);
    expect(inBand(500, 500 - R * (1 - RING_FRACTION) - 1, W, H)).toBe(false);
  });
  it('draws the claim circle exactly over the band', () => {
    const { r, strokeWidth } = bandCircle();
    expect(r - strokeWidth / 2).toBeCloseTo(300, 6);
    expect(r + strokeWidth / 2).toBeCloseTo(500 * (1 - RING_FRACTION), 6);
  });
  it('measures angles clockwise from 12', () => {
    expect(angleFrom12(0, -1, 0, 0)).toBeCloseTo(0);
    expect(angleFrom12(1, 0, 0, 0)).toBeCloseTo(90);
    expect(angleFrom12(0, 1, 0, 0)).toBeCloseTo(180);
    expect(angleFrom12(-1, 0, 0, 0)).toBeCloseTo(270);
  });
  it('unwraps across 12 so the drag never jumps', () => {
    expect(unwrapDelta(350, 10)).toBe(20);
    expect(unwrapDelta(10, 350)).toBe(-20);
    expect(unwrapDelta(90, 120)).toBe(30);
  });
  it('maps one revolution to 60 minutes', () => {
    expect(degreesToMs(360)).toBe(MAX_MS);
    expect(degreesToMs(30)).toBe(5 * 60_000);
    expect(msToDegrees(15 * 60_000)).toBe(90);
  });
});
