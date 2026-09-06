// Pure mapping from the app.fireplace schema (intensity, hue) to the particle
// simulation's numbers. The defaults MUST reproduce the pre-schema behaviour
// exactly: 3 particles per frame, yellow → orange → red flames, orange embers.

import { describe, it, expect } from 'vitest';
import { spawnPerFrame, flameColor, emberColor } from './fire-params';

describe('spawnPerFrame', () => {
  it('medium is the historical 3 per frame', () => {
    expect(spawnPerFrame('medium')).toBe(3);
  });
  it('calm spawns fewer and roaring more', () => {
    expect(spawnPerFrame('calm')).toBeLessThan(3);
    expect(spawnPerFrame('roaring')).toBeGreaterThan(3);
  });
});

describe('flameColor (classic reproduces the original gradient)', () => {
  it('young particles are pale yellow', () => {
    expect(flameColor('classic', 0.1)).toEqual({ r: 255, g: 255, b: 100 });
  });
  it('mid-life particles are orange, green channel falling with age', () => {
    expect(flameColor('classic', 0.3)).toEqual({ r: 255, g: Math.floor(180 - 0.3 * 200), b: 0 });
  });
  it('old particles fade from red to dark, never below zero', () => {
    expect(flameColor('classic', 0.6)).toEqual({ r: Math.floor(255 - 0.1 * 400), g: 0, b: 0 });
    const end = flameColor('classic', 1);
    expect(end.r).toBeGreaterThanOrEqual(0);
    expect(end.g).toBe(0);
    expect(end.b).toBe(0);
  });
});

describe('flameColor (other hues)', () => {
  it.each(['cool', 'blue', 'purple'] as const)('%s stays inside 0..255 across a lifetime', (hue) => {
    for (const t of [0, 0.1, 0.2, 0.35, 0.5, 0.75, 1]) {
      const c = flameColor(hue, t);
      for (const ch of [c.r, c.g, c.b]) {
        expect(ch).toBeGreaterThanOrEqual(0);
        expect(ch).toBeLessThanOrEqual(255);
        expect(Number.isInteger(ch)).toBe(true);
      }
    }
  });
  it('blue and purple flames are visibly not orange', () => {
    expect(flameColor('blue', 0.3).b).toBeGreaterThan(flameColor('blue', 0.3).r);
    expect(flameColor('purple', 0.3).b).toBeGreaterThan(flameColor('purple', 0.3).g);
  });
});

describe('emberColor', () => {
  it('classic embers are the original orange glow', () => {
    expect(emberColor('classic', 0.3)).toBe('rgba(255, 100, 0, 0.3)');
    expect(emberColor('classic', 0)).toBe('rgba(255, 100, 0, 0)');
  });
  it('every hue yields an rgba() string carrying the alpha', () => {
    for (const hue of ['classic', 'cool', 'blue', 'purple'] as const) {
      expect(emberColor(hue, 0.3)).toMatch(/^rgba\(\d+, \d+, \d+, 0\.3\)$/);
    }
  });
});
