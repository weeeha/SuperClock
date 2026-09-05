// Unit tests for the token liveness predicates. The module is fs-free (same
// shape as token-rules.mjs): the real-tree gate in
// src/shared/token-liveness.test.ts owns file walking; every judgment lives
// here where fixtures can reach it.
//
// Lineage: ds-architecture starter-kit/01-tokens/liveness.test.ts (declared
// token → alias → a component that reads it). Adapted because SuperClock reads
// tokens three ways: kiosk @theme tokens as Tailwind utilities or var(),
// --face-* as var() in face SVG/style attributes, admin tokens as
// hsl(var(--x)) arbitrary values and .admin-root rules.

import { describe, it, expect } from 'vitest';
import {
  declaredTokens,
  stripDeclarations,
  readerPattern,
  findReaders,
  auditLiveness,
  UNCONSUMED_LEDGER,
} from './token-liveness.mjs';

const KIOSK_CSS = `
@import 'tailwindcss';
@theme {
  --color-accent: #ff8826;
  --color-sheet: #171717;
  --font-family-display: 'Inter', system-ui, sans-serif;
}
:root,
html.light {
  --face-bg: #ffffff;
  --face-ink: #000000;
}
html.dark {
  --face-bg: #000000;
  --face-ink: #ffffff;
}
html, body { font-family: var(--font-family-display); }
`;

describe('declaredTokens — every custom property a stylesheet declares', () => {
  it('lists each declared name once, in first-seen order, across @theme and selector blocks', () => {
    expect(declaredTokens(KIOSK_CSS)).toEqual([
      '--color-accent',
      '--color-sheet',
      '--font-family-display',
      '--face-bg',
      '--face-ink',
    ]);
  });

  it('does not mistake a var() read for a declaration', () => {
    expect(declaredTokens(`body { color: var(--face-ink); }`)).toEqual([]);
  });
});

describe('stripDeclarations — a declaration is never a reader', () => {
  it('removes declaration lines and keeps rules that read a token', () => {
    const out = stripDeclarations(
      `.admin-root {\n  --background: 0 0% 4%;\n  background-color: hsl(var(--background));\n}`,
    );
    expect(out).not.toContain('--background: 0 0% 4%');
    expect(out).toContain('hsl(var(--background))');
  });
});

describe('readerPattern — what counts as reading a token', () => {
  it('kiosk @theme color: the Tailwind utility, with a variant prefix or an opacity modifier', () => {
    const re = readerPattern('--color-accent');
    for (const s of [
      'className="bg-accent"',
      'hover:text-accent',
      'border-accent/40',
      'fill-accent',
      'stroke-accent',
    ]) {
      expect(re.test(s), s).toBe(true);
    }
  });

  it('kiosk @theme color: a var() read counts too', () => {
    expect(readerPattern('--color-accent').test(`style={{ color: 'var(--color-accent)' }}`)).toBe(
      true,
    );
  });

  it('a longer utility name does not satisfy a shorter token', () => {
    const re = readerPattern('--color-accent');
    expect(re.test('bg-accents')).toBe(false);
    expect(re.test('bg-accent-foreground')).toBe(false);
  });

  it('a longer var() name does not satisfy a shorter token', () => {
    expect(readerPattern('--face-ink').test('var(--face-ink-muted)')).toBe(false);
    expect(readerPattern('--face-ink').test('fill="var(--face-ink)"')).toBe(true);
  });

  it("Tailwind's bg-(--x) shorthand is a read (Quote, Depletion and Daylight use it)", () => {
    expect(readerPattern('--face-bg').test('className="theme-fade bg-(--face-bg)"')).toBe(true);
    expect(readerPattern('--face-ink').test('text-(--face-ink-muted)')).toBe(false);
  });

  it('kiosk @theme font: the font-* utility Tailwind derives from the name, or var()', () => {
    const re = readerPattern('--font-family-display');
    expect(re.test('className="font-family-display"')).toBe(true);
    expect(re.test('font-family: var(--font-family-display)')).toBe(true);
    // Tailwind v4 derives the utility from the full name after --font-, so a
    // shorter class is a no-op, not a reader.
    expect(re.test('className="font-display"')).toBe(false);
  });

  it('admin token: hsl(var(--x)) inside an arbitrary value', () => {
    const re = readerPattern('--warning');
    expect(re.test('className="bg-[hsl(var(--warning)/0.1)]"')).toBe(true);
    expect(re.test('var(--warning-foreground)')).toBe(false);
  });
});

describe('findReaders — which sources read a token', () => {
  const sources = [
    { file: 'src/apps/clock/AnalogClock.tsx', text: `<circle fill="var(--face-ink)" />` },
    { file: 'src/apps/clock/StrokesClock.tsx', text: `const ghost = 'var(--face-ghost)';` },
    { file: 'src/index.css', text: stripDeclarations(KIOSK_CSS) },
  ];

  it('returns the files that read the token', () => {
    expect(findReaders('--face-ink', sources)).toEqual(['src/apps/clock/AnalogClock.tsx']);
  });

  it('a stylesheet counts only through a rule that reads, never through its declaration', () => {
    expect(findReaders('--font-family-display', sources)).toEqual(['src/index.css']);
    expect(findReaders('--face-bg', sources)).toEqual([]);
  });
});

describe('auditLiveness — live, ledgered, dead, stale ledger', () => {
  const sources = [{ file: 'a.tsx', text: 'bg-accent var(--face-ink)' }];
  const tokens = ['--color-accent', '--face-ink', '--color-temp-high', '--color-sheet'];
  const ledger = [
    { token: '--color-temp-high', reason: 'weather art direction never adopted these; wire or delete' },
    { token: '--face-ink', reason: 'stale entry: this token has a reader now' },
    { token: '--color-nope', reason: 'stale entry: never declared' },
  ];

  it('sorts every declared token into exactly one of live, ledgered, dead', () => {
    const out = auditLiveness(tokens, sources, ledger);
    expect(out.live).toEqual(['--color-accent', '--face-ink']);
    expect(out.ledgered).toEqual(['--color-temp-high']);
    expect(out.dead).toEqual(['--color-sheet']);
  });

  it('flags ledger entries that went stale: a reader appeared, or the token is no longer declared', () => {
    const out = auditLiveness(tokens, sources, ledger);
    expect(out.staleLedger).toEqual(['--face-ink', '--color-nope']);
  });
});

describe('UNCONSUMED_LEDGER — shrink-only, every entry carries a reason', () => {
  it('each entry names a token and a reason a reviewer can act on', () => {
    for (const entry of UNCONSUMED_LEDGER) {
      expect(entry.token).toMatch(/^--[\w-]+$/);
      expect(entry.reason.length, `${entry.token} needs a real reason`).toBeGreaterThanOrEqual(20);
    }
  });
});
