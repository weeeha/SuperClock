// Path-scoped rule files (.claude/rules/*.md) — the split between what every
// session needs and what only a session touching certain files needs.
//
// Claude Code loads a rule with `paths:` frontmatter only when it reads a
// matching file, so a typo'd glob is worse than a missing rule: it never loads
// and nothing says so. This gate makes the split honest in both directions:
//
//   - every rule declares a non-empty `paths` list, and every glob in it
//     matches at least one tracked file;
//   - every rule is named from AGENTS.md, so agents that do not read
//     `.claude/rules/` (Codex and friends, which read AGENTS.md) still learn
//     the rule exists and where to find it;
//   - every rule file AGENTS.md names exists (the docs-drift gate checks the
//     path; this one checks it is a rule with frontmatter);
//   - a moved section leaves a stub behind — the rule's `summary` line must
//     appear in AGENTS.md, so the portable file still states the rule even
//     though its body moved.
//
// Lineage: design-system-rebuild's agents-stub-provenance gate (a rule in
// AGENTS.md is a one-line stub naming its body and its gate, or it stays
// inline with a stated reason).

import { describe, it, expect } from 'vitest';
import { globSync, readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url'; // never URL.pathname — this checkout path contains spaces
import { resolve, join } from 'node:path';

const root = resolve(fileURLToPath(new URL('../..', import.meta.url)));
const RULES_DIR = '.claude/rules';

interface ScopedRule {
  file: string;
  paths: string[];
  summary: string;
}

/** Minimal frontmatter reader: the `paths:` list and the `summary:` line.
 *  Deliberately not a YAML dependency — the shape is fixed and a parser would
 *  hide a malformed block behind a permissive parse. */
export function parseRuleFrontmatter(source: string): { paths: string[]; summary: string } | null {
  const m = /^---\n([\s\S]*?)\n---\n/.exec(source);
  if (!m) return null;
  const body = m[1];
  const paths = [...body.matchAll(/^\s*-\s*["']?([^"'\n]+?)["']?\s*$/gm)].map((x) => x[1]);
  // A summary carrying a `: ` (the gestures rule quotes `mode: 'transitioning'`)
  // must be quoted in YAML; the quotes are syntax, not part of the sentence
  // that gets stubbed into AGENTS.md.
  const raw = /^summary:\s*(.+)$/m.exec(body)?.[1]?.trim() ?? '';
  const summary = /^(["'])([\s\S]*)\1$/.exec(raw)?.[2] ?? raw;
  return { paths, summary };
}

const ruleFiles = readdirSync(join(root, RULES_DIR))
  .filter((f) => f.endsWith('.md'))
  .sort();

const rules: ScopedRule[] = ruleFiles.map((file) => {
  const parsed = parseRuleFrontmatter(readFileSync(join(root, RULES_DIR, file), 'utf8'));
  return { file, paths: parsed?.paths ?? [], summary: parsed?.summary ?? '' };
});

const agents = readFileSync(join(root, 'AGENTS.md'), 'utf8');

describe('path-scoped rules', () => {
  it('there are rules to check', () => {
    expect(rules.length).toBeGreaterThan(0);
  });

  it.each(rules.map((r) => [r.file]))('%s has frontmatter with a paths list and a summary', (file) => {
    const rule = rules.find((r) => r.file === file)!;
    expect(rule.paths.length, `${file}: no \`paths:\` entries — the rule would never load`).toBeGreaterThan(0);
    expect(rule.summary.length, `${file}: no \`summary:\` line to stub into AGENTS.md`).toBeGreaterThan(0);
  });

  it.each(rules.flatMap((r) => r.paths.map((p) => [r.file, p])))(
    '%s: glob %s matches at least one tracked file',
    (file, pattern) => {
      const matches = globSync(pattern, { cwd: root }).filter((f) => !f.includes('node_modules'));
      expect(
        matches.length,
        `${file}: \`${pattern}\` matches nothing, so this rule never loads (typo, or the code moved)`,
      ).toBeGreaterThan(0);
    },
  );

  it.each(rules.map((r) => [r.file]))('%s is named from AGENTS.md so non-Claude agents find it', (file) => {
    expect(
      agents.includes(`${RULES_DIR}/${file}`),
      `AGENTS.md never names ${RULES_DIR}/${file}; agents that do not read .claude/rules/ would not know the rule exists`,
    ).toBe(true);
  });

  it.each(rules.map((r) => [r.file, r.summary]))('%s leaves its summary in AGENTS.md', (file, summary) => {
    expect(
      agents.includes(summary),
      `AGENTS.md must still state the rule itself: expected the \`summary\` of ${file} verbatim.`,
    ).toBe(true);
  });

  it('every .claude/rules path AGENTS.md names is a real rule file', () => {
    const named = [...agents.matchAll(/`\.claude\/rules\/([\w-]+\.md)`/g)].map((m) => m[1]);
    expect(named.length, 'AGENTS.md names no rule files').toBeGreaterThan(0);
    for (const name of named) {
      expect(ruleFiles, `AGENTS.md names ${RULES_DIR}/${name} but no such rule exists`).toContain(name);
    }
  });
});
