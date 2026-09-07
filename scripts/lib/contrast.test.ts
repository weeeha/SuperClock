// Unit tests for the pure contrast predicates. Fs-free like its siblings
// (token-tiers.mjs, token-rules.mjs): the real-tree gate
// (src/shared/token-contrast.test.ts) owns reading tokens.css; judgment
// lives here where vitest can reach it directly.

import { describe, it, expect } from 'vitest';
import { parseColor, contrastRatio, resolveThemeValue } from './contrast.mjs';

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

// A tier 2 role in tokens.css is not the only place a contrast pair's name
// can resolve: the kiosk also declares plain-hex tokens directly inside
// src/index.css's @theme block, outside the tier system entirely. These
// fixtures stand in for that file's shape without reading it from disk.
describe('resolveThemeValue', () => {
  const css = [
    '@theme {',
    '  --color-accent: #ff8826;',
    '  --color-sheet: #171717;',
    '}',
    '',
    '.theme-fade {',
    '  --color-b: #222222;',
    '  color: red;',
    '}',
  ].join('\n');

  it('reads a literal declared inside the @theme block', () => {
    expect(resolveThemeValue(css, '--color-sheet')).toBe('#171717');
  });

  it('returns null for a token the block does not declare, so a caller reports it unreadable rather than skipping it', () => {
    expect(resolveThemeValue(css, '--color-missing')).toBeNull();
  });

  it('does not match a declaration outside the @theme block', () => {
    expect(resolveThemeValue(css, '--color-b')).toBeNull();
  });

  it('returns null when the text has no @theme block at all', () => {
    expect(resolveThemeValue('.rule { color: red; }', '--color-sheet')).toBeNull();
  });
});
