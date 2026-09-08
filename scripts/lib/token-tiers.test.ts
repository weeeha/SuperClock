// scripts/lib/token-tiers.test.ts
// Fixture tests for the tier predicates. The module is fs-free like its
// siblings (token-rules, token-liveness, lvgl-parity, parts-index): the
// real-tree gates own file reading, every judgment lives here.
import { describe, it, expect } from 'vitest';
import { parseTiers, missingModes, tierViolations, consumedRamps } from './token-tiers.mjs';

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

  it('flags a tier 2 role pointing at a ramp that was never declared', () => {
    // var()-shaped, so the old shape-only check would have passed it. The
    // ramp name is dangling: nothing in the tier 1 block declares it, so
    // the role resolves to nothing at render time.
    const css = CSS.replace('--face-ink: var(--stone-1000);', '--face-ink: var(--gray-40);');
    expect(tierViolations(parseTiers(css))).toContain('--face-ink');
  });

  it('allows a bare HSL triplet reference, the admin transitional form', () => {
    // The ramp must be declared for this to demonstrate the allowed form
    // rather than the dangling-reference case above.
    const css = CSS
      .replace('--stone-1000: #000000;', '--stone-1000: #000000;\n  --gray-40: 0 0% 40%;')
      .replace('--face-ink: var(--stone-1000);', '--face-ink: var(--gray-40);');
    expect(tierViolations(parseTiers(css))).toEqual([]);
  });

  it('is empty when every role points at a ramp', () => {
    expect(tierViolations(parseTiers(CSS))).toEqual([]);
  });
});

describe('consumedRamps', () => {
  it('collects every ramp a tier 2 role points at, across both modes', () => {
    // --stone-0 is read by --face-bg (dark) and --only-light (light);
    // --stone-1000 by --face-bg (light) and --face-ink (dark). The set
    // de-duplicates: each ramp appears once no matter how many roles or
    // modes reference it.
    expect(consumedRamps(parseTiers(CSS))).toEqual(new Set(['--stone-0', '--stone-1000']));
  });

  it('a ramp no role points at is absent from the set', () => {
    const css = CSS.replace('--stone-1000: #000000;', '--stone-1000: #000000;\n  --stone-unused: #ff00ff;');
    expect(consumedRamps(parseTiers(css)).has('--stone-unused')).toBe(false);
  });

  it('a dangling reference names no ramp, so it contributes nothing here either', () => {
    // Same fixture tierViolations already flags this shape with: the ramp
    // named in the var() was never declared in tier 1. consumedRamps must
    // not report a ramp that does not exist just because something typo'd
    // its name into a var().
    const css = CSS.replace('--face-ink: var(--stone-1000);', '--face-ink: var(--gray-40);');
    expect(consumedRamps(parseTiers(css)).has('--gray-40')).toBe(false);
  });

  it('is empty when tier 2 declares no roles', () => {
    expect(consumedRamps({ ramps: ['--stone-0'], light: {}, dark: {} })).toEqual(new Set());
  });
});
