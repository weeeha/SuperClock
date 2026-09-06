// The catalogue's own gate (rules/superclock.json). A rule that cannot be
// parsed, whose pattern cannot be compiled, that bans something without saying
// what to do instead, or whose exemption has no reason fails HERE rather than
// at detection time. Every mechanical rule must also prove its claim on a
// fixture pair: it fires on `<id>-bad.tsx` and stays quiet on `<id>-good.tsx`.
// Lineage: design-system-rebuild catalogue.test.ts + the proven-claim half of
// its rulecheck.test.ts.

import { describe, it, expect } from 'vitest';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url'; // never URL.pathname — this checkout path contains spaces
import { resolve } from 'node:path';
// @ts-expect-error — .mjs, deliberately untyped
import { loadRules, scan } from '../rulecheck.mjs';
// @ts-expect-error — .mjs, deliberately untyped
import { ruleSchema, RULE_ID_PATTERN, isMechanical, patternsOf } from './rule-schema.mjs';

const root = resolve(fileURLToPath(new URL('../..', import.meta.url)));
const FIXTURES = 'scripts/lib/__fixtures__/rules';

interface AnyRule {
  id: string;
  severity: string;
  fix: string;
  detect: Record<string, unknown> & { method: string; exempt?: { path: string; reason: string }[] };
}

const ALL: AnyRule[] = loadRules(root);

describe('rule catalogue (rules/*.json)', () => {
  it('has rules', () => {
    expect(ALL.length).toBeGreaterThan(0);
  });

  it('every rule parses against the schema', () => {
    for (const rule of ALL) {
      const result = ruleSchema.safeParse(rule);
      expect(result.success, `${rule.id}: ${result.error?.message}`).toBe(true);
    }
  });

  it('ids are unique and follow the id scheme', () => {
    const ids = ALL.map((r) => r.id);
    expect(new Set(ids).size, `duplicate id in ${ids.join(', ')}`).toBe(ids.length);
    for (const id of ids) expect(id, `bad id ${id}`).toMatch(RULE_ID_PATTERN);
  });

  it('every pattern compiles (a broken regex must fail here, not silently match nothing)', () => {
    for (const rule of ALL) {
      for (const p of patternsOf(rule)) {
        expect(
          () => new RegExp(p, String(rule.detect.flags ?? '').replace(/g/g, '')),
          `${rule.id} pattern does not compile: ${p}`,
        ).not.toThrow();
      }
    }
  });

  it('every rule carries a substitution, not just a ban', () => {
    for (const rule of ALL) expect(rule.fix.trim().length, `${rule.id} has an empty fix`).toBeGreaterThan(0);
  });

  it('every exemption is a decision with a reason', () => {
    for (const rule of ALL) {
      for (const e of rule.detect.exempt ?? []) {
        expect(e.path?.length, `${rule.id} exempt entry without a path`).toBeGreaterThan(0);
        expect(e.reason?.trim().length, `${rule.id} exempts ${e.path} without a reason`).toBeGreaterThan(0);
      }
    }
  });
});

const MECHANICAL = ALL.filter((r) => isMechanical(r));

describe('every mechanical rule has a proven claim', () => {
  it.each(MECHANICAL.map((r) => [r.id]))('%s fires on its bad fixture and not its good one', (id) => {
    const slug = id.toLowerCase();
    const rule = MECHANICAL.find((r) => r.id === id)!;
    const scoped = { ...rule, detect: { ...rule.detect, scope: [FIXTURES], exempt: [] } };
    const bad = `${FIXTURES}/${slug}-bad.tsx`;
    const good = `${FIXTURES}/${slug}-good.tsx`;
    expect(existsSync(resolve(root, bad)), `${id} has no bad fixture at ${bad}`).toBe(true);
    expect(existsSync(resolve(root, good)), `${id} has no good fixture at ${good}`).toBe(true);
    expect(scan([scoped], [bad], root).violations.length, `${id} did not fire on its bad fixture`).toBeGreaterThan(0);
    expect(scan([scoped], [good], root).violations, `${id} fired on its good fixture`).toHaveLength(0);
  });
});
