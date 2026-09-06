// Machine-readable form of SuperClock's design rules (rules/superclock.json).
// One record holds what a prose checklist splits across a skill and a script:
// the rule, its severity, AND how (or whether) it can be detected. Keeping
// them in one record is the point: when the rule list and the detector list
// are separate documents they drift, and "I did not check this" becomes
// indistinguishable from "this passed". A rule whose method is `judgment` or
// `rendered` is structurally unrunnable, so the runner reports it as unchecked
// on every run without anyone deciding to; a `delegated` rule names the gate
// that does check it.
//
// Provenance: ds-architecture starter-kit 02-rules/schema.ts, ported to .mjs
// (zod is a dependency here) with three extensions: `requires`, `delegated`,
// and exemptions as { path, reason }. Patterns are STRINGS, not RegExp
// literals: the record is JSON for the dependency-free runner, and
// rule-catalogue.test.ts compiles every one so a broken pattern fails
// `npm test` instead of silently matching nothing.

import { z } from 'zod';

export const CATALOGUE_VERSION = 1;

// Portable prefixes keep the anti-slop corpus ids (COL-1 means the same thing
// here as in the donor repos); NAV/KIO/FCE are SuperClock's own topics.
export const RULE_ID_PATTERN = /^(COL|TYP|LAY|CMP|ICO|MOT|CPY|CHT|STA|SYS|NAV|KIO|FCE)-\d+$/;

/** A sanctioned exception is a decision: it names the path substring and says why. */
const exemptEntry = z.object({ path: z.string().min(1), reason: z.string().min(1) });

const scopeFields = {
  flags: z.string().regex(/^[dgimsuvy]*$/, 'invalid RegExp flags'),
  /** Directory prefixes, repo-relative. */
  scope: z.array(z.string().min(1)).min(1),
  /** File extensions, with the dot. */
  include: z.array(z.string().regex(/^\.[a-z]+$/)).min(1),
  exempt: z.array(exemptEntry),
};

const grepDetect = z.object({ method: z.literal('grep'), pattern: z.string().min(1), ...scopeFields });

const heuristicDetect = z.object({
  method: z.literal('heuristic'),
  pattern: z.string().min(1),
  ...scopeFields,
  /** What this pattern is known to match wrongly. Required: a heuristic whose
   *  false positives nobody has characterised cannot be promoted to blocking. */
  falsePositives: z.string().min(1),
});

/** Co-occurrence: a file that matches `when` must also match `must`. One
 *  finding per file, at the first `when` line. */
const requiresDetect = z.object({
  method: z.literal('requires'),
  when: z.string().min(1),
  must: z.string().min(1),
  ...scopeFields,
  falsePositives: z.string().min(1).optional(),
});

const renderedDetect = z.object({
  method: z.literal('rendered'),
  /** What to do in a browser (or on the glass) to check it. */
  how: z.string().min(1),
});

const judgmentDetect = z.object({
  method: z.literal('judgment'),
  /** What to look at, and what would make it a violation. */
  how: z.string().min(1),
});

/** Enforced by another gate in this repo; `gate` is that file's path. */
const delegatedDetect = z.object({
  method: z.literal('delegated'),
  gate: z.string().min(1),
  how: z.string().min(1),
});

export const detectSchema = z.discriminatedUnion('method', [
  grepDetect,
  heuristicDetect,
  requiresDetect,
  renderedDetect,
  judgmentDetect,
  delegatedDetect,
]);

export const ruleSchema = z.object({
  id: z.string().regex(RULE_ID_PATTERN, 'must follow the id scheme, e.g. COL-1 or NAV-1'),
  /** One line, imperative, as it reads in a report. */
  title: z.string().min(1),
  /** blocker = a hard ban; the tree gate holds it at zero.
   *  review  = needs a human call, or a blocker-in-waiting with baseline debt.
   *  warning = drift; fix unless there is a documented reason. */
  severity: z.enum(['blocker', 'review', 'warning']),
  detect: detectSchema,
  /** The substitution. A ban without a fix is a wish. */
  fix: z.string().min(1),
  /** Why the rule exists. A bare "don't" gets rationalized away. */
  why: z.string().min(1).optional(),
});

export function isMechanical(rule) {
  return ['grep', 'heuristic', 'requires'].includes(rule.detect.method);
}

/** Every regex string a rule carries, for the compile check. */
export function patternsOf(rule) {
  const d = rule.detect;
  if (d.method === 'grep' || d.method === 'heuristic') return [d.pattern];
  if (d.method === 'requires') return [d.when, d.must];
  return [];
}
