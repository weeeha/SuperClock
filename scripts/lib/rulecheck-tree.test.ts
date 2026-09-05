// The gate that runs the rule catalogue over the real tree, under `npm test`.
// `npm run check:rules` prints the same report for a human (and exits 1 on
// any hit); THIS file decides pass/fail, in two populations:
//
//   ZERO TOLERANCE — every (rule, file) pair not in BASELINE. A rule the tree
//     satisfies today stays satisfied: the first violation fails, and it reads
//     as "a rule that was clean and is not anymore", never as a new baseline
//     row.
//   BASELINE — debt that existed when the catalogue was frozen, per (rule,
//     file), allowed to shrink and never grow. Two-way, like SCHEMA_UNREAD and
//     unlike a plain ratchet: a row whose debt is now smaller than recorded
//     also fails, so the ledger is deleted the day the fix lands instead of
//     silently over-provisioning headroom.
//
// Promotion criterion (from the donor's AGENTS.md): a rule ships at `review`
// while it has baseline rows and is promoted to `blocker` when its rows reach
// zero. NAV-1 is the live example — see rules/superclock.json.
// Lineage: design-system-rebuild rulecheck-ratchet.test.ts.

import { describe, it, expect } from 'vitest';
import { fileURLToPath } from 'node:url'; // never URL.pathname — this checkout path contains spaces
import { resolve } from 'node:path';
// @ts-expect-error — .mjs, deliberately untyped
import { loadRules, scan, walk } from '../rulecheck.mjs';

const root = resolve(fileURLToPath(new URL('../..', import.meta.url)));

/** Frozen 2026-09-05. Key = `<rule id> <repo-relative file>`, value = hits.
 *  May only shrink; a fixed row must be deleted (the stale-row test fails
 *  otherwise). */
export const BASELINE: Record<string, number> = {
  // Arbitrary px values: off-scale literals awaiting a scale decision.
  'LAY-4 src/apps/todo/TodoApp.tsx': 1,
  'LAY-4 src/admin/routes/Apps.tsx': 1,
  // outline-none without a focus-visible pairing on the same line.
  'STA-3 src/admin/lib/array-fields.tsx': 1,
  // Guarded cleanup missing: the two registrants that null the shared slot
  // unconditionally. Fix both, delete the rows, promote NAV-1 to blocker.
  'NAV-1 src/apps/agents/AgentsApp.tsx': 1,
  'NAV-1 src/apps/weather/WeatherApp.tsx': 1,
};

interface Violation {
  id: string;
  severity: string;
  file: string;
  line: number;
  snippet: string;
  fix: string;
}

const rules = loadRules(root);
const scopes: string[] = [...new Set(rules.flatMap((r: { detect: { scope?: string[] } }) => r.detect.scope ?? []))];
const extensions: string[] = [
  ...new Set(rules.flatMap((r: { detect: { include?: string[] } }) => r.detect.include ?? [])),
];
const report = scan(rules, walk(root, scopes, extensions), root);

const counts = new Map<string, Violation[]>();
for (const v of report.violations as Violation[]) {
  const key = `${v.id} ${v.file}`;
  counts.set(key, [...(counts.get(key) ?? []), v]);
}

describe('rule catalogue over the tree', () => {
  it('scans something (a walk that finds no files is a broken map, not a clean tree)', () => {
    expect(report.summary.filesScanned).toBeGreaterThan(20);
  });

  it('no (rule, file) pair exceeds its baseline; pairs off the baseline are zero-tolerance', () => {
    const over: string[] = [];
    for (const [key, hits] of counts) {
      const allowed = BASELINE[key] ?? 0;
      if (hits.length > allowed) {
        const where = hits.map((h) => `${h.file}:${h.line}  ${h.snippet}\n      fix: ${h.fix}`).join('\n    ');
        over.push(`  ${key}: ${hits.length} hit(s), ${allowed} allowed\n    ${where}`);
      }
    }
    expect(over, `rule violations beyond the baseline:\n${over.join('\n')}`).toEqual([]);
  });

  it('every baseline row is still exactly true (debt that shrank must be re-recorded or deleted)', () => {
    const stale = Object.entries(BASELINE)
      .filter(([key, allowed]) => (counts.get(key)?.length ?? 0) < allowed)
      .map(([key, allowed]) => `${key}: recorded ${allowed}, now ${counts.get(key)?.length ?? 0}`);
    expect(stale, `stale baseline row(s):\n  ${stale.join('\n  ')}`).toEqual([]);
  });

  it('every baseline row names a rule that exists', () => {
    const ids = new Set(rules.map((r: { id: string }) => r.id));
    for (const key of Object.keys(BASELINE)) {
      expect(ids.has(key.split(' ')[0]), `baseline row for unknown rule: ${key}`).toBe(true);
    }
  });

  it('judgment and rendered rules are reported as unchecked, never counted as passed', () => {
    const declared = rules.filter(
      (r: { detect: { method: string } }) => r.detect.method === 'judgment' || r.detect.method === 'rendered',
    );
    expect(report.unchecked.map((u: { id: string }) => u.id).sort()).toEqual(
      declared.map((r: { id: string }) => r.id).sort(),
    );
  });
});
