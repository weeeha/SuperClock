// scripts/lib/token-tiers.test.ts
// Fixture tests for the tier predicates. The module is fs-free like its
// siblings (token-rules, token-liveness, lvgl-parity, parts-index): the
// real-tree gates own file reading, every judgment lives here.
import { describe, it, expect } from 'vitest';
import { parseTiers, missingModes, tierViolations } from './token-tiers.mjs';

const CSS = `
/* Tier 1 */
:root {
  --stone-0: #ffffff;
  --stone-1000: #000000;
}
/* Tier 2 */
:root, html.light {
  --face-bg: var(--stone-0);
  --face-ink: var(--stone-1000);
  --only-light: var(--stone-0);
}
html.dark {
  --face-bg: var(--stone-1000);
  --face-ink: var(--stone-0);
}
`;

describe('parseTiers', () => {
  it('separates the ramp block from the two mode blocks', () => {
    const t = parseTiers(CSS);
    expect(t.ramps).toEqual(['--stone-0', '--stone-1000']);
    expect(Object.keys(t.light)).toEqual(['--face-bg', '--face-ink', '--only-light']);
    expect(Object.keys(t.dark)).toEqual(['--face-bg', '--face-ink']);
  });

  it('keeps each role its raw declared value', () => {
    expect(parseTiers(CSS).light['--face-bg']).toBe('var(--stone-0)');
  });
});

describe('missingModes', () => {
  it('names a role declared light-only', () => {
    expect(missingModes(parseTiers(CSS))).toEqual(['--only-light']);
  });

  it('names a role declared dark-only', () => {
    const css = CSS + '\nhtml.dark { --only-dark: var(--stone-0); }';
    expect(missingModes(parseTiers(css)).sort()).toEqual(['--only-dark', '--only-light']);
  });

  it('is empty when every role carries both', () => {
    const css = CSS.replace('  --only-light: var(--stone-0);\n', '');
    expect(missingModes(parseTiers(css))).toEqual([]);
  });
});

describe('tierViolations', () => {
  it('flags a tier 2 role holding a literal instead of a ramp reference', () => {
    const css = CSS.replace('--face-ink: var(--stone-1000);', '--face-ink: #111111;');
    expect(tierViolations(parseTiers(css))).toContain('--face-ink');
  });

  it('allows a bare HSL triplet reference, the admin transitional form', () => {
    const css = CSS.replace('--face-ink: var(--stone-1000);', '--face-ink: var(--gray-40);');
    expect(tierViolations(parseTiers(css))).toEqual([]);
  });

  it('is empty when every role points at a ramp', () => {
    expect(tierViolations(parseTiers(CSS))).toEqual([]);
  });
});
