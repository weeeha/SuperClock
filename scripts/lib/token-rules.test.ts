// Unit tests for the pure token-gate predicates. The module is fs-free on
// purpose (ported shape from Super-AI-Components): the runner
// (scripts/check-tokens.mjs) owns globbing and exit codes; everything with
// judgment lives here where vitest can reach it.

import { describe, it, expect } from 'vitest';
import {
  findSemanticZoneViolations,
  findSingleStringViolations,
  findCvaViolations,
  extractCvaCalls,
  parseFaceComponentFiles,
  findFaceTokenGap,
  FACE_TOKEN_EXEMPT,
} from './token-rules.mjs';

const FILE = 'src/admin/routes/Example.tsx';

describe('findSemanticZoneViolations — raw values in semantic-only zones', () => {
  it('flags raw hex colors', () => {
    const out = findSemanticZoneViolations(FILE, `const c = '#ff6b35';`);
    expect(out).toHaveLength(1);
    expect(out[0]).toContain('raw hex color');
  });

  it('flags raw color functions (oklch/rgb/hsl)', () => {
    const src = [
      `const a = 'oklch(0.7 0.1 50)';`,
      `const b = 'rgb(255 0 0)';`,
      `const c = 'hsl(20 96% 60%)';`,
    ].join('\n');
    expect(findSemanticZoneViolations(FILE, src)).toHaveLength(3);
  });

  it('flags tailwind palette classes, including with opacity modifiers', () => {
    const src = [
      `<span className="text-green-400" />`,
      `<div className="border-amber-400/30 bg-amber-400/10" />`,
    ].join('\n');
    const out = findSemanticZoneViolations(FILE, src);
    // one finding per line, not per class — the fix is per-line anyway
    expect(out).toHaveLength(2);
    expect(out[1]).toContain('tailwind palette class');
  });

  it('leaves semantic utilities and CSS vars alone', () => {
    const src = [
      `<div className="bg-background text-muted-foreground border-border" />`,
      `const ring = 'var(--face-ink)';`,
      `<b className="text-success bg-warning/10" />`,
    ].join('\n');
    expect(findSemanticZoneViolations(FILE, src)).toHaveLength(0);
  });

  it('allows color functions whose first argument is a token var() — the admin idiom', () => {
    const src = [
      `<input className="border-[hsl(var(--border))] bg-transparent" />`,
      `<i className="bg-[hsl(var(--warning)/0.1)]" />`,
      `const thumb = 'hsl(var(--muted))';`,
    ].join('\n');
    expect(findSemanticZoneViolations(FILE, src)).toHaveLength(0);
  });

  it('documented limitation: issue refs like #1234 match the hex pattern — write GH-1234', () => {
    expect(findSemanticZoneViolations(FILE, `// fixes #1234`)).toHaveLength(1);
  });

  it('a token-gate:allow comment on the line suppresses the finding', () => {
    const src = `const hex = '#000000'; // token-gate:allow color-input fallback value, not styling`;
    expect(findSemanticZoneViolations(FILE, src)).toHaveLength(0);
  });
});

describe('findSingleStringViolations — muted-on-muted inside one class list', () => {
  it('flags text-muted-foreground paired with bg-muted in one string', () => {
    const out = findSingleStringViolations(FILE, `<p className="text-muted-foreground bg-muted p-2" />`);
    expect(out).toHaveLength(1);
    expect(out[0]).toContain('4.5');
  });

  it('does not merge separate quoted strings (ternary branches are exclusive)', () => {
    const src = `const cls = on ? 'bg-muted' : 'text-muted-foreground';`;
    expect(findSingleStringViolations(FILE, src)).toHaveLength(0);
  });

  it('ignores variant-prefixed backgrounds (hover:bg-accent swaps text too)', () => {
    const src = `<p className="text-muted-foreground hover:bg-accent" />`;
    expect(findSingleStringViolations(FILE, src)).toHaveLength(0);
  });
});

describe('extractCvaCalls / findCvaViolations — muted-on-muted across cva base and variants', () => {
  it('flags a base text-muted-foreground paired with a variant bg-muted', () => {
    const src = `const v = cva('text-muted-foreground', { variants: { tone: { flat: 'bg-muted' } } });`;
    expect(findCvaViolations(FILE, src)).toHaveLength(1);
  });

  it('does not pair two variant values with each other (mutually exclusive)', () => {
    const src = `const v = cva('flex', { variants: { tone: { a: 'bg-muted', b: 'text-muted-foreground' } } });`;
    expect(findCvaViolations(FILE, src)).toHaveLength(0);
  });

  it('extractCvaCalls survives nested parens in arbitrary values and comments', () => {
    const src = [
      `const v = cva('p-1 [&:not(:first-child)]:mt-2', {`,
      `  // TODO (see GH-123`,
      `  variants: { s: { a: 'max-w-(--x)' } },`,
      `});`,
    ].join('\n');
    const calls = extractCvaCalls(src);
    expect(calls).toHaveLength(1);
    expect(calls[0].body).toContain('max-w-(--x)');
  });
});

describe('parseFaceComponentFiles — face list reconciled from real imports', () => {
  const source = [
    `import type { ComponentType } from 'react';`,
    `import MinimalismoClock from './MinimalismoClock';`,
    `import ComplicationsLight from './ComplicationsLight';`,
    `import StrokesClock from './StrokesClock';`,
  ].join('\n');

  it('returns the imported face component basenames', () => {
    expect(parseFaceComponentFiles(source)).toEqual([
      'MinimalismoClock',
      'ComplicationsLight',
      'StrokesClock',
    ]);
  });

  it('ignores non-relative imports (react types are not faces)', () => {
    expect(parseFaceComponentFiles(source)).not.toContain('ComponentType');
  });
});

describe('findFaceTokenGap — every face must consume the night-aware --face-* set', () => {
  it('passes a face that reads a --face-* token', () => {
    const src = `const bg = 'var(--face-bg)';`;
    expect(findFaceTokenGap('src/apps/clock/StrokesClock.tsx', src)).toBeNull();
  });

  it('flags a face with no --face-* reference', () => {
    const gap = findFaceTokenGap('src/apps/clock/NewClock.tsx', `const bg = '#111';`);
    expect(gap).toContain('--face-');
  });

  it('exempts the legacy list (shrink-only) and pins its exact membership', () => {
    for (const name of FACE_TOKEN_EXEMPT) {
      expect(findFaceTokenGap(`src/apps/clock/${name}`, `const x = 1;`)).toBeNull();
    }
    expect([...FACE_TOKEN_EXEMPT].sort()).toEqual(
      [
        'AnalogClock.tsx',
        'ComplicationsDark.tsx',
        'FlipClock.tsx',
        'FloralClock.tsx',
        'ProductivityClock.tsx',
        'SquareClock.tsx',
        'WorldClock.tsx',
      ].sort(),
    );
  });
});
