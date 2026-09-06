// Pure mapping from the app.github schema to what the app needs: a 5-step
// heatmap palette per colorScheme, a per-user cache key, and the proxy URL.
// The defaults MUST reproduce the pre-schema behaviour: GitHub's green ramp,
// the viewer's own calendar, the historical cache key.

import { describe, it, expect } from 'vitest';
import { paletteFor, cacheKeyFor, contributionsUrl, GITHUB_GREENS } from './github-config';

describe('paletteFor', () => {
  it('default is the historical GitHub green ramp', () => {
    expect(paletteFor('default')).toEqual(GITHUB_GREENS);
    expect(GITHUB_GREENS).toEqual(['#161b22', '#0e4429', '#006d32', '#26a641', '#39d353']);
  });
  it('monochrome keeps the empty cell and ramps through greys', () => {
    const p = paletteFor('monochrome');
    expect(p).toHaveLength(5);
    expect(p[0]).toBe('#161b22');
    expect(p.slice(1).every((c) => /^#[0-9a-f]{6}$/.test(c))).toBe(true);
  });
  it('accent keeps the empty cell and ends on the configured accent token', () => {
    const p = paletteFor('accent');
    expect(p).toHaveLength(5);
    expect(p[0]).toBe('#161b22');
    expect(p[4]).toBe('var(--color-accent)');
    expect(p.slice(1, 4).every((c) => c.startsWith('color-mix(in srgb, var(--color-accent)'))).toBe(true);
  });
});

describe('cacheKeyFor', () => {
  it('blank username keeps the historical key so an existing cache still seeds the boot paint', () => {
    expect(cacheKeyFor('')).toBe('superclock:github:contrib');
    expect(cacheKeyFor('   ')).toBe('superclock:github:contrib');
  });
  it('a username gets its own key so one user never paints another user\'s cached graph', () => {
    expect(cacheKeyFor('weeeha')).toBe('superclock:github:contrib:weeeha');
    expect(cacheKeyFor(' Weeeha ')).toBe('superclock:github:contrib:weeeha');
  });
});

describe('contributionsUrl', () => {
  it('blank username asks the proxy for the token owner (viewer)', () => {
    expect(contributionsUrl('')).toBe('/api/github/contributions');
  });
  it('a username is passed as a query parameter, encoded', () => {
    expect(contributionsUrl('weeeha')).toBe('/api/github/contributions?username=weeeha');
    expect(contributionsUrl('a b')).toBe('/api/github/contributions?username=a%20b');
  });
});
