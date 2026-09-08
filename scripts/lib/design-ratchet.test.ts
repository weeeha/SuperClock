import { describe, expect, it } from 'vitest';
import {
  extractColours,
  extractFontSizes,
  hexToHsl,
  isBannedHue,
  CEILINGS,
  BANNED_HUE_LEDGER,
} from './design-ratchet.mjs';

describe('design ratchet predicates', () => {
  it('collects tailwind and svg font sizes alike', () => {
    const s = 'text-xs text-[3vmin] fontSize="42" fontSize={58}';
    expect(extractFontSizes(s).size).toBe(4);
  });

  it('counts one distinct size once, however often it repeats', () => {
    expect(extractFontSizes('text-xl text-xl text-xl').size).toBe(1);
  });

  // Tailwind overloads text-[…]: a length is a font size, a colour is not.
  it('does not count an arbitrary text-[] colour as a font size', () => {
    expect(extractFontSizes('text-[#8b949e]').size).toBe(0);
    expect(extractFontSizes('text-[hsl(var(--sheet-ink))]').size).toBe(0);
    expect(extractFontSizes('text-[rgb(1,2,3)] text-[oklch(0.5 0 0)]').size).toBe(0);
  });

  it('still counts the length form of text-[]', () => {
    expect(extractFontSizes('text-[3vmin] text-[13px] text-[length:var(--x)]').size).toBe(3);
  });

  it('collects hex colours case-insensitively as one value', () => {
    expect(extractColours('#FF8826 #ff8826').size).toBe(1);
  });

  it('parses shorthand and full hex to the same colour', () => {
    expect(hexToHsl('#fff')).toEqual(hexToHsl('#ffffff'));
  });

  it('reports greys as unsaturated', () => {
    expect(hexToHsl('#808080')?.s).toBe(0);
  });

  it('returns null rather than guessing at an unparseable value', () => {
    expect(hexToHsl('#12345')).toBeNull();
    expect(hexToHsl('#zzzzzz')).toBeNull();
  });

  // The whole point of computing hue: COL-6's own detector matches
  // `bg-indigo-500` and would miss every one of these.
  it('catches indigo, violet and purple written as hex', () => {
    for (const hex of ['#6366f1', '#7c3aed', '#a855f7', '#c084fc', '#e879f9']) {
      expect(isBannedHue(hex), `${hex} should be a banned hue`).toBe(true);
    }
  });

  it('leaves the system its own hues', () => {
    // the kiosk accent, a GitHub green, a sky blue, white, black and a grey
    for (const hex of ['#ff8826', '#39d353', '#3866bf', '#ffffff', '#000000', '#666666']) {
      expect(isBannedHue(hex), `${hex} should be allowed`).toBe(false);
    }
  });

  it('does not flag a desaturated near-grey that happens to sit in the hue band', () => {
    expect(isBannedHue('#3a3a3e')).toBe(false);
  });

  it('states both ceilings as positive integers', () => {
    expect(CEILINGS.fontSizes).toBeGreaterThan(0);
    expect(CEILINGS.colours).toBeGreaterThan(0);
  });

  it('gives every banned-hue ledger row a positive count', () => {
    for (const [file, n] of Object.entries(BANNED_HUE_LEDGER)) {
      expect(n, `${file} must record how many`).toBeGreaterThan(0);
    }
  });
});
