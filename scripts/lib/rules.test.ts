// Meta-tests for the rule catalog. The catalog is the one record of every
// rule this repo enforces or merely claims: a rule with a detector names the
// script or test that runs it; a rule with none says so in an `unchecked`
// reason, and check:tokens prints those on every run. These tests keep the
// record honest: a `checkedBy` that names nothing real is a claim reporting
// success with nothing having inspected it.
//
// Lineage: ds-architecture ("a rule and its detector are the same record";
// "un-checkability is a declared field, not a silence").

import { describe, it, expect } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import { RULES, uncheckedRules, formatUnchecked } from './rules.mjs';

const npmScripts = Object.keys(JSON.parse(readFileSync('package.json', 'utf8')).scripts);

describe('rule catalog — one record per rule, each with a detector or a declared reason it has none', () => {
  it('has rules to check', () => {
    expect(RULES.length).toBeGreaterThan(0);
  });

  it('ids are unique and shaped R<two digits>', () => {
    const ids = RULES.map((r) => r.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const id of ids) expect(id).toMatch(/^R\d{2}$/);
  });

  it('every rule states what it requires and why (a bare rule gets rationalised away)', () => {
    for (const r of RULES) {
      expect(r.statement.length, r.id).toBeGreaterThanOrEqual(20);
      expect(r.why.length, r.id).toBeGreaterThanOrEqual(20);
    }
  });

  it('every rule is checkedBy something or unchecked with a reason, never both and never neither', () => {
    for (const r of RULES) {
      const hasDetector = typeof r.checkedBy === 'string';
      const hasReason = typeof r.unchecked === 'string';
      expect(hasDetector !== hasReason, `${r.id}: exactly one of checkedBy / unchecked`).toBe(true);
    }
  });

  it('every checkedBy resolves: an npm script in package.json, or an existing vitest file', () => {
    for (const r of RULES) {
      if (!r.checkedBy) continue;
      const script = /^npm (?:run )?(\S+)$/.exec(r.checkedBy);
      if (script) {
        expect(npmScripts, `${r.id}: no npm script "${script[1]}"`).toContain(script[1]);
      } else {
        expect(existsSync(r.checkedBy), `${r.id}: ${r.checkedBy} does not exist`).toBe(true);
        expect(r.checkedBy, `${r.id}: a detector file must be a vitest test so npm test reaches it`).toMatch(
          /\.test\.tsx?$/,
        );
      }
    }
  });

  it('every unchecked reason is real prose: what would check it, and who enforces it meanwhile', () => {
    for (const r of RULES) {
      if (r.unchecked === undefined) continue;
      expect(r.unchecked.length, `${r.id}: "${r.unchecked}" is not a reason`).toBeGreaterThanOrEqual(40);
    }
  });

  it('uncheckedRules returns exactly the rules without a detector', () => {
    const ids = uncheckedRules().map((r) => r.id);
    expect(ids).toEqual(RULES.filter((r) => !r.checkedBy).map((r) => r.id));
  });

  it('formatUnchecked prints one line per unchecked rule, with id and statement, and an empty string when none', () => {
    const lines = formatUnchecked(uncheckedRules()).split('\n').filter(Boolean);
    expect(lines).toHaveLength(uncheckedRules().length);
    for (const r of uncheckedRules()) {
      expect(lines.some((l) => l.includes(r.id) && l.includes(r.statement)), r.id).toBe(true);
    }
    expect(formatUnchecked([])).toBe('');
  });
});
