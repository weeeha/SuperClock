// Claims on the rule engine (scripts/rulecheck.mjs). Ported from
// design-system-rebuild's rulecheck.test.ts with two SuperClock extensions:
//   - `requires` detect method: a file that matches `when` must also match
//     `must` (the guarded-cleanup contract is a co-occurrence, not a grep);
//   - `exempt` entries are { path, reason } objects — every sanctioned
//     exception is a decision and says why.
// A rule is a claim with two halves: it fires on the bad case, and it stays
// quiet on the good one. Only the second half makes a blocking hook safe.

import { describe, it, expect } from 'vitest';
import { fileURLToPath } from 'node:url'; // never URL.pathname — this checkout path contains spaces
import { resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
// @ts-expect-error — .mjs detector, deliberately untyped so it stays stdlib-only
import { scan, stripComments, walk } from '../rulecheck.mjs';

const root = resolve(fileURLToPath(new URL('../..', import.meta.url)));
const FIXTURES = 'scripts/lib/__fixtures__/rules';

type Detect = Record<string, unknown>;
interface TestRule {
  id: string;
  title: string;
  severity: 'blocker' | 'review' | 'warning';
  detect: Detect;
  fix: string;
}

function grepRule(over: Partial<TestRule> = {}, detect: Detect = {}): TestRule {
  return {
    id: 'COL-1',
    title: 'Zero gradients',
    severity: 'blocker',
    detect: {
      method: 'grep',
      pattern: 'bg-gradient-|bg-clip-text',
      flags: '',
      scope: [FIXTURES],
      include: ['.tsx'],
      exempt: [],
      ...detect,
    },
    fix: 'Flat token; emphasis via size, weight, position.',
    ...over,
  };
}

const navRule: TestRule = {
  id: 'NAV-1',
  title: 'Shared nav-store slots are released with a guarded cleanup',
  severity: 'blocker',
  detect: {
    method: 'requires',
    when: 'setVerticalSwipeCallback\\(',
    must: 'verticalSwipeCallback === ',
    flags: '',
    scope: [FIXTURES],
    include: ['.tsx'],
    exempt: [],
  },
  fix: 'Copy HabitsApp: capture the callback in a const and null the slot only if it is still yours.',
};

interface Violation {
  id: string;
  severity: string;
  file: string;
  line: number;
  snippet: string;
  fix: string;
}

describe('rulecheck: grep claims', () => {
  it('fires on the bad fixture with the line and the fix', () => {
    const { violations } = scan([grepRule()], [`${FIXTURES}/col-1-bad.tsx`], root);
    expect(violations).toHaveLength(1);
    expect(violations[0].id).toBe('COL-1');
    expect(violations[0].line).toBe(2);
    expect(violations[0].fix).toMatch(/flat token/i);
  });

  it('stays quiet on the good fixture', () => {
    const { violations } = scan([grepRule()], [`${FIXTURES}/col-1-good.tsx`], root);
    expect(violations).toHaveLength(0);
  });

  it('reads code, not the prose that talks about code (comments are stripped first)', () => {
    const quiet = scan([grepRule()], [`${FIXTURES}/col-1-comment.tsx`], root);
    expect(quiet.violations).toHaveLength(0);
    const loud = scan([grepRule()], [`${FIXTURES}/col-1-bad.tsx`], root);
    expect(loud.violations[0].line).toBe(2);
  });

  it('reports a judgment or rendered rule as unchecked rather than passed', () => {
    const judgment = grepRule(
      { id: 'FCE-1', severity: 'review' },
      { method: 'judgment', how: 'Count saturated accent quantities on the rendered face.' },
    );
    const rendered = grepRule(
      { id: 'A11Y-1', severity: 'review' },
      { method: 'rendered', how: 'Sample contrast on the painted surface.' },
    );
    const { violations, unchecked } = scan([judgment, rendered], [`${FIXTURES}/col-1-good.tsx`], root);
    expect(violations).toHaveLength(0);
    expect(unchecked).toEqual([
      { id: 'FCE-1', reason: 'judgment' },
      { id: 'A11Y-1', reason: 'rendered' },
    ]);
  });

  it('reports a rule with no target files as unchecked (out-of-scope), never as passed', () => {
    const { unchecked } = scan([grepRule({}, { include: ['.css'] })], [`${FIXTURES}/col-1-bad.tsx`], root);
    expect(unchecked).toEqual([{ id: 'COL-1', reason: 'out-of-scope' }]);
  });

  it('sorts deterministically by severity, file, line, id', () => {
    const warn = grepRule({ id: 'COL-9', severity: 'warning' });
    const { violations } = scan([warn, grepRule()], [`${FIXTURES}/col-1-bad.tsx`], root);
    expect(violations.map((v: Violation) => v.id)).toEqual(['COL-1', 'COL-9']);
  });

  it('strips a global flag so every matching line is reported, not every other one', () => {
    const { violations } = scan([grepRule({}, { flags: 'g' })], [`${FIXTURES}/col-1-twice.tsx`], root);
    expect(violations.map((v: Violation) => v.line)).toEqual([2, 3]);
  });
});

describe('rulecheck: exemptions carry a reason', () => {
  it('skips a file whose path contains an exempt entry path', () => {
    const exempt = [{ path: 'col-1-bad.tsx', reason: 'fixture proving the exemption mechanism' }];
    const { violations } = scan([grepRule({}, { exempt })], [`${FIXTURES}/col-1-bad.tsx`], root);
    expect(violations).toHaveLength(0);
  });

  it('does not skip files the entry does not name', () => {
    const exempt = [{ path: 'col-1-good.tsx', reason: 'unrelated file' }];
    const { violations } = scan([grepRule({}, { exempt })], [`${FIXTURES}/col-1-bad.tsx`], root);
    expect(violations).toHaveLength(1);
  });
});

describe('rulecheck: requires (co-occurrence) claims', () => {
  it('fires once per file when `when` matches and `must` is absent, at the first `when` line', () => {
    const { violations } = scan([navRule], [`${FIXTURES}/nav-1-bad.tsx`], root);
    expect(violations).toHaveLength(1);
    expect(violations[0].id).toBe('NAV-1');
    expect(violations[0].line).toBe(4);
    expect(violations[0].snippet).toContain('setVerticalSwipeCallback(');
  });

  it('stays quiet when both patterns are present', () => {
    const { violations } = scan([navRule], [`${FIXTURES}/nav-1-good.tsx`], root);
    expect(violations).toHaveLength(0);
  });

  it('stays quiet when `when` never matches (the rule does not apply to the file)', () => {
    const { violations } = scan([navRule], [`${FIXTURES}/col-1-good.tsx`], root);
    expect(violations).toHaveLength(0);
  });

  it('ignores a `must` that only appears in a comment', () => {
    const { violations } = scan([navRule], [`${FIXTURES}/nav-1-comment.tsx`], root);
    expect(violations).toHaveLength(1);
  });
});

describe('rulecheck: stripComments', () => {
  it('blanks line and block comments, keeps strings, preserves length and line breaks', () => {
    const fixture = [
      `const url = "https://x.dev/a//b" // trailing note`,
      `/* block`,
      `   spanning */ const s = 'it\\'s "/*" fine'`,
      `<Code>image/*</Code>`,
      'const t = `tick // not a comment`',
    ].join('\n');
    const out = stripComments(fixture);
    expect(out.length).toBe(fixture.length);
    expect(out.split('\n').length).toBe(fixture.split('\n').length);
    expect(out).not.toContain('trailing note');
    expect(out).not.toContain('block');
    expect(out).toContain('https://x.dev/a//b');
    expect(out).toContain('tick // not a comment');
    expect(out).toContain('image/*');
  });
});

describe('rulecheck: CLI', () => {
  const run = (...args: string[]) =>
    spawnSync(process.execPath, ['scripts/rulecheck.mjs', ...args], { cwd: root, encoding: 'utf8' });

  it('--json emits the full report shape over the real tree', () => {
    const r = run('--json');
    const report = JSON.parse(r.stdout);
    expect(report.summary.filesScanned).toBeGreaterThan(20);
    expect(Array.isArray(report.violations)).toBe(true);
    expect(Array.isArray(report.unchecked)).toBe(true);
    expect(Array.isArray(report.delegated)).toBe(true);
  });

  it('single-file mode (--files, the hook path) prints findings only, no unchecked/delegated footer', () => {
    const r = run('--files', `${FIXTURES}/col-1-good.tsx`, '--severity', 'blocker');
    expect(r.status).toBe(0);
    expect(r.stdout).not.toContain('unchecked');
    expect(r.stdout).not.toContain('delegated');
  });
});

describe('rulecheck: walk', () => {
  it('lists files under the scopes by extension, skipping dot-dirs and node_modules', () => {
    const files: string[] = walk(root, [FIXTURES], ['.tsx']);
    expect(files).toContain(`${FIXTURES}/col-1-bad.tsx`);
    expect(files.every((f) => f.endsWith('.tsx'))).toBe(true);
    expect(files.some((f) => f.includes('node_modules'))).toBe(false);
  });
});
