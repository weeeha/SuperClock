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
//
// stripComments / stripCssComments now live in scripts/lib/comment-strip.mjs
// (fixture-tested directly there, in scripts/lib/comment-strip.test.ts) and
// are re-exported here for this module's own callers. The two
// "comments are not readers" blocks and the "historical failure" block
// below still cover the fix for a read inside a comment counting as a real
// one, at the point it matters for this module: composed with findReaders
// and auditLiveness, the same way the real-tree gate
// (src/shared/token-liveness.test.ts) actually uses them.

import { describe, it, expect } from 'vitest';
import {
  declaredTokens,
  stripDeclarations,
  readerPattern,
  findReaders,
  auditLiveness,
  UNCONSUMED_LEDGER,
  stripComments,
  stripCssComments,
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

describe('comments are not readers: .ts/.tsx sources (stripComments, from scripts/lib/comment-strip.mjs)', () => {
  const sourcesFor = (text: string) => [{ file: 'src/apps/clock/AnalogClock.tsx', text: stripComments(text) }];

  it('a var() inside a line comment does not count', () => {
    const sources = sourcesFor('// var(--face-ink) explained the old approach\nconst x = 1;');
    expect(findReaders('--face-ink', sources)).toEqual([]);
  });

  it('a var() inside a block comment does not count', () => {
    const sources = sourcesFor('/* var(--face-ink) was read here before the refactor */\nconst x = 1;');
    expect(findReaders('--face-ink', sources)).toEqual([]);
  });

  it('a real read on the same line as a trailing comment still counts', () => {
    const sources = sourcesFor('<circle fill="var(--face-ink)" /> // the face outline');
    expect(findReaders('--face-ink', sources)).toEqual(['src/apps/clock/AnalogClock.tsx']);
  });

  it('a comment marker inside a string literal does not eat real code', () => {
    const sources = sourcesFor(
      'const note = "not a real /* comment */ marker";\nconst ink = \'var(--face-ink)\';',
    );
    expect(findReaders('--face-ink', sources)).toEqual(['src/apps/clock/AnalogClock.tsx']);
  });

  it('a Tailwind utility-shaped mention inside a comment does not count either', () => {
    const sources = sourcesFor('// used to read bg-accent for the dial\nconst x = 1;');
    expect(findReaders('--color-accent', sources)).toEqual([]);
  });
});

describe('comments are not readers: .css sources (stripCssComments)', () => {
  const sourcesFor = (text: string) => [
    { file: 'src/styles/tokens.css', text: stripDeclarations(stripCssComments(text)) },
  ];

  it('a var() inside a block comment does not count', () => {
    const sources = sourcesFor(
      ['/* plus one opaque black (--scrim-knob) for the toggle knob */', ':root {', '  --scrim-knob: 0 0 0;', '}'].join(
        '\n',
      ),
    );
    expect(findReaders('--scrim-knob', sources)).toEqual([]);
  });

  it('a real read on the same line as a trailing comment still counts', () => {
    const sources = sourcesFor('.x {\n  background: var(--face-ink); /* the face plate */\n}');
    expect(findReaders('--face-ink', sources)).toEqual(['src/styles/tokens.css']);
  });

  it('a comment marker inside a string literal does not eat real code', () => {
    const sources = sourcesFor('.x {\n  content: "/* not a real comment */";\n  background: var(--face-ink);\n}');
    expect(findReaders('--face-ink', sources)).toEqual(['src/styles/tokens.css']);
  });
});

describe('the historical failure this module now catches: a token kept alive only by a comment', () => {
  // Same shape as the retired --sheet-bg (git history: tokens.css explained
  // --sheet-950 with a comment that happened to spell var(--sheet-bg), which
  // is exactly what kept --sheet-bg passing without a real reader). The
  // comment sits on its own lines, separate from any declaration, so
  // stripDeclarations alone never removes it, only stripCssComments does.
  const rawCss = [
    ':root, html.light {',
    '  /* Ghost role: kept only so a comment can point at var(--ghost-role);',
    '     no component ever renders it. */',
    '  --ghost-role: #171717;',
    '}',
  ].join('\n');

  it('is reported dead once the caller strips comments before building sources', () => {
    const sources = [{ file: 'src/styles/tokens.css', text: stripDeclarations(stripCssComments(rawCss)) }];
    expect(auditLiveness(['--ghost-role'], sources, []).dead).toEqual(['--ghost-role']);
  });

  it('was reported live under the old, comment-oblivious composition, pinning what changed', () => {
    const sources = [{ file: 'src/styles/tokens.css', text: stripDeclarations(rawCss) }];
    expect(auditLiveness(['--ghost-role'], sources, []).live).toEqual(['--ghost-role']);
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

describe('auditLiveness: extraLive, the tier-aware escape hatch', () => {
  // Only src/styles/tokens.css has this shape: a tier 1 ramp is declared,
  // then read exclusively by a tier 2 role in the same file. stripDeclarations
  // removes that read along with the declaration line it lives on (both are
  // the same line), so no ordinary source walk can ever find it. extraLive is
  // how a caller who has already done that tier-aware reasoning elsewhere
  // (token-tiers.mjs's consumedRamps, in src/shared/token-liveness.test.ts)
  // tells auditLiveness the token is not actually dead.
  const sources = [{ file: 'src/styles/tokens.css', text: '' }]; // declarations already stripped, nothing left to read
  const tokens = ['--stone-0', '--stone-unused'];

  it('a token with no reader is dead by default, extraLive included or not', () => {
    expect(auditLiveness(tokens, sources).dead).toEqual(['--stone-0', '--stone-unused']);
    expect(auditLiveness(tokens, sources, [], []).dead).toEqual(['--stone-0', '--stone-unused']);
  });

  it('a token named in extraLive is live even though no source reads it', () => {
    const out = auditLiveness(tokens, sources, [], ['--stone-0']);
    expect(out.live).toEqual(['--stone-0']);
    expect(out.dead).toEqual(['--stone-unused']);
  });

  it('does not spill onto a token that was not named', () => {
    // Guards against a version that marks everything live once anything is
    // passed, which would be the blanket loosening this parameter must not be.
    const out = auditLiveness(tokens, sources, [], ['--stone-0']);
    expect(out.dead).not.toContain('--stone-0');
    expect(out.live).not.toContain('--stone-unused');
  });

  it('a ledger entry for a token extraLive now covers is reported stale', () => {
    const ledger = [{ token: '--stone-0', reason: 'was unread before the tier-aware rule existed' }];
    const out = auditLiveness(tokens, sources, ledger, ['--stone-0']);
    expect(out.live).toEqual(['--stone-0']);
    expect(out.ledgered).toEqual([]);
    expect(out.staleLedger).toEqual(['--stone-0']);
  });
});

describe('UNCONSUMED_LEDGER — shrink-only, every entry carries a reason', () => {
  it('each entry names a token and a reason a reviewer can act on', () => {
    for (const entry of UNCONSUMED_LEDGER) {
      expect(entry.token).toMatch(/^--[\w-]+$/);
      expect(entry.reason.length, `${entry.token} needs a real reason`).toBeGreaterThanOrEqual(20);
    }
  });

  // Same discipline as FACE_TOKEN_EXEMPT's pin in token-rules.test.ts:
  // "may only shrink" is a comment above the array unless something fails
  // when membership changes without this test also changing. Before this
  // pin, the ledger grew from 7 entries to 21 across the token-layer work
  // with nothing that would have failed had an addition been silent. This
  // makes growth (or shrinkage) a visible, deliberate edit: touch
  // UNCONSUMED_LEDGER without touching this list, and this test names
  // exactly which token(s) moved.
  it('pins the exact membership: adding or removing an entry must edit this list too', () => {
    expect([...UNCONSUMED_LEDGER.map((entry) => entry.token)].sort()).toEqual(
      [
        // The original 7.
        '--color-temp-high',
        '--color-temp-low',
        '--accent',
        '--accent-foreground',
        '--input',
        '--popover-foreground',
        '--radius',
        // Group 1: the always-dark quick-settings sheet's mode-inverting
        // generic ink roles, wrong for that surface (see the entries'
        // own reasons in token-liveness.mjs).
        '--ink',
        '--ink-muted',
        // Group 2: the admin's shadcn vocabulary, deferred whole to
        // sub-project 2.
        '--surface-ground',
        '--surface-card',
        '--surface-sheet',
        '--surface-popover',
        '--brand',
        '--brand-ink',
        '--status-danger',
        '--status-ok',
        '--status-warn',
        '--status-warn-ink',
        '--line',
        '--focus',
      ].sort(),
    );
  });
});
