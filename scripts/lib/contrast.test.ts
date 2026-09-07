// Unit tests for the pure contrast predicates. Fs-free like its siblings
// (token-tiers.mjs, token-rules.mjs): the real-tree gate
// (src/shared/token-contrast.test.ts) owns reading tokens.css; judgment
// lives here where vitest can reach it directly.

import { describe, it, expect } from 'vitest';
import { parseColor, contrastRatio } from './contrast.mjs';

describe('parseColor', () => {
  it('reads a six-digit hex', () => {
    expect(parseColor('#ffffff')).toEqual({ r: 255, g: 255, b: 255 });
  });
  it('reads a bare HSL triplet, the admin form', () => {
    expect(parseColor('0 0% 0%')).toEqual({ r: 0, g: 0, b: 0 });
  });
  it('returns null for a form it does not understand, so the gate can say so', () => {
    expect(parseColor('var(--x)')).toBeNull();
    expect(parseColor('255 255 255 / 0.5')).toBeNull();
  });
});

describe('contrastRatio', () => {
  it('is 21 for black on white', () => {
    expect(Math.round(contrastRatio({ r: 0, g: 0, b: 0 }, { r: 255, g: 255, b: 255 }))).toBe(21);
  });
  it('is 1 for a colour against itself', () => {
    expect(contrastRatio({ r: 18, g: 18, b: 18 }, { r: 18, g: 18, b: 18 })).toBe(1);
  });
  it('is symmetric', () => {
    const a = { r: 10, g: 20, b: 30 };
    const b = { r: 200, g: 210, b: 220 };
    expect(contrastRatio(a, b)).toBeCloseTo(contrastRatio(b, a), 10);
  });
});
