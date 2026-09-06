#!/usr/bin/env node
// Rule catalogue runner. Reads rules/*.json and reports violations plus what
// it could not check. Stdlib only: it runs from the PostToolUse hook, from
// vitest (scripts/lib/rulecheck*.test.ts) and from a shell, none of which
// should need a build step. It never assigns severity and never invents a
// rule: there is exactly one place it could read them from.
//
// Provenance: harvested from design-system-rebuild scripts/rulecheck.mjs
// (via the ds-architecture starter kit) under the "port, don't rewrite" rule.
// Three deliberate SuperClock extensions, each pinned by scripts/lib/rulecheck.test.ts:
//   - `requires`: a file matching `when` must also match `must` (the
//     guarded-cleanup contract is a co-occurrence, not a grep);
//   - `exempt` entries are { path, reason } objects: a sanctioned exception is
//     a decision and says why;
//   - `delegated`: a rule enforced by another gate names that gate and is
//     reported as delegated, never as passed or unchecked.
//
// Policy (what fails `npm test`) lives in scripts/lib/rulecheck-tree.test.ts;
// this CLI exits 1 on ANY hit so a human sees the whole report.

import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url'; // never URL.pathname — this checkout path contains spaces

const SEVERITY_RANK = { blocker: 0, review: 1, warning: 2 };
const SKIP_DIRS = new Set(['node_modules', 'dist', 'build']);

export function loadRules(root) {
  const dir = path.join(root, 'rules');
  if (!existsSync(dir)) throw new Error('rules/ not found — the catalogue lives in rules/*.json');
  return readdirSync(dir)
    .filter((f) => f.endsWith('.json'))
    .sort()
    .flatMap((f) => JSON.parse(readFileSync(path.join(dir, f), 'utf8')).rules);
}

export function walk(root, scopes, extensions) {
  const out = [];
  const visit = (rel) => {
    const abs = path.join(root, rel);
    if (!existsSync(abs)) return;
    for (const entry of readdirSync(abs)) {
      if (SKIP_DIRS.has(entry) || entry.startsWith('.')) continue;
      const childRel = path.join(rel, entry);
      if (statSync(path.join(root, childRel)).isDirectory()) visit(childRel);
      else if (extensions.includes(path.extname(entry))) out.push(childRel);
    }
  };
  scopes.forEach(visit);
  return out.sort();
}

// Character state machine: blanks // and /* */ comments, keeps string
// contents intact, preserves length and line breaks so reported line numbers
// still point at the real line. A `/` glued to a word character is JSX prose
// or a URL, not a comment opener. Harvested verbatim.
const WORD_BEFORE_SLASH = /[A-Za-z0-9_$]/;

export function stripComments(source) {
  const out = [];
  let mode = 'code';
  for (let i = 0; i < source.length; i++) {
    const c = source[i];
    const next = source[i + 1];
    if (mode === 'code') {
      const glued = WORD_BEFORE_SLASH.test(source[i - 1] ?? '');
      if (c === '/' && next === '/' && !glued) {
        mode = 'line';
        out.push('  ');
        i++;
      } else if (c === '/' && next === '*' && !glued) {
        mode = 'block';
        out.push('  ');
        i++;
      } else {
        if (c === "'" || c === '"' || c === '`') mode = c;
        out.push(c);
      }
      continue;
    }
    if (mode === 'line') {
      if (c === '\n') {
        mode = 'code';
        out.push('\n');
      } else out.push(' ');
      continue;
    }
    if (mode === 'block') {
      if (c === '*' && next === '/') {
        mode = 'code';
        out.push('  ');
        i++;
      } else out.push(c === '\n' ? '\n' : ' ');
      continue;
    }
    if (c === '\\') {
      out.push(c, next ?? '');
      i++;
      continue;
    }
    if (c === mode) mode = 'code';
    out.push(c);
  }
  return out.join('');
}

// Strip `g`: the loops below call re.test() once per line, and a global regex
// advances lastIndex across calls, so every other matching line would read as
// clean. The schema permits `g` in flags, so this is handled here.
function compile(pattern, flags) {
  return new RegExp(pattern, String(flags ?? '').replace(/g/g, ''));
}

function violation(rule, d, file, line, snippet) {
  return {
    id: rule.id,
    severity: rule.severity,
    method: d.method,
    confidence: d.method === 'grep' ? 'high' : 'medium',
    file,
    line,
    snippet: snippet.trim().slice(0, 120),
    fix: rule.fix,
  };
}

export function scan(rules, files, root) {
  const violations = [];
  const unchecked = [];
  const delegated = [];

  for (const rule of rules) {
    const d = rule.detect;

    if (d.method === 'rendered' || d.method === 'judgment') {
      unchecked.push({ id: rule.id, reason: d.method });
      continue;
    }
    if (d.method === 'delegated') {
      delegated.push({ id: rule.id, gate: d.gate });
      continue;
    }

    const targets = files.filter(
      (f) =>
        d.scope.some((s) => f === s || f.startsWith(`${s}/`)) &&
        d.include.includes(path.extname(f)) &&
        !d.exempt.some((e) => f.includes(e.path)),
    );

    if (targets.length === 0) {
      unchecked.push({ id: rule.id, reason: 'out-of-scope' });
      continue;
    }

    if (d.method === 'requires') {
      const when = compile(d.when, d.flags);
      const must = compile(d.must, d.flags);
      for (const file of targets) {
        const source = stripComments(readFileSync(path.join(root, file), 'utf8'));
        if (must.test(source)) continue;
        const lines = source.split('\n');
        const first = lines.findIndex((line) => when.test(line));
        if (first === -1) continue;
        violations.push(violation(rule, d, file, first + 1, lines[first]));
      }
      continue;
    }

    const re = compile(d.pattern, d.flags);
    for (const file of targets) {
      // Comments are stripped first: a pattern quoted in a header comment is
      // prose about the rule, not a violation of it. Character-preserving, so
      // line numbers still hold.
      const lines = stripComments(readFileSync(path.join(root, file), 'utf8')).split('\n');
      lines.forEach((line, i) => {
        if (!re.test(line)) return;
        violations.push(violation(rule, d, file, i + 1, line));
      });
    }
  }

  violations.sort(
    (a, b) =>
      SEVERITY_RANK[a.severity] - SEVERITY_RANK[b.severity] ||
      a.file.localeCompare(b.file) ||
      a.line - b.line ||
      a.id.localeCompare(b.id),
  );

  const summary = { blocker: 0, review: 0, warning: 0, filesScanned: files.length };
  for (const v of violations) summary[v.severity] += 1;

  return { violations, unchecked, delegated, summary };
}

function main(argv) {
  const root = process.cwd();
  const arg = (name) => {
    const i = argv.indexOf(name);
    return i === -1 ? null : argv[i + 1];
  };
  const list = (name) => {
    const i = argv.indexOf(name);
    if (i === -1) return null;
    const out = [];
    for (let j = i + 1; j < argv.length && !argv[j].startsWith('--'); j += 1) out.push(argv[j]);
    return out;
  };

  let rules = loadRules(root);
  const severity = arg('--severity');
  if (severity) rules = rules.filter((r) => r.severity === severity);

  const explicit = list('--files');
  const scopes = [...new Set(rules.flatMap((r) => r.detect.scope ?? []))];
  const extensions = [...new Set(rules.flatMap((r) => r.detect.include ?? []))];
  const files = explicit ?? walk(root, scopes, extensions);

  const report = scan(rules, files, root);

  if (argv.includes('--json')) {
    process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
  } else {
    for (const v of report.violations) {
      process.stdout.write(`${v.file}:${v.line}  ${v.id} [${v.severity}]  ${v.snippet}\n    fix: ${v.fix}\n`);
    }
    const s = report.summary;
    process.stdout.write(
      `\n${report.violations.length} violation(s) in ${s.filesScanned} file(s): ${s.blocker} blocker, ${s.review} review, ${s.warning} warning.\n`,
    );
    // The unchecked/delegated footer describes the catalogue, not the files
    // just scanned: it belongs to a whole-tree report, and is noise in the
    // single-file (hook) mode, where the only news is the finding itself.
    if (explicit === null) {
      const ids = report.unchecked.map((u) => `${u.id}(${u.reason})`).join(' ');
      process.stdout.write(`unchecked (needs a human or a browser): ${ids || 'none'}\n`);
      const gates = report.delegated.map((u) => `${u.id}→${u.gate}`).join(' ');
      process.stdout.write(`delegated to other gates: ${gates || 'none'}\n`);
    }
  }

  return report.violations.length > 0 ? 1 : 0;
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  try {
    process.exit(main(process.argv.slice(2)));
  } catch (error) {
    // Exit 2 is the fail-open signal: "I could not tell", distinct from
    // "nothing is wrong". Callers that block must treat it as non-blocking.
    process.stderr.write(`rulecheck: ${error.message}\n`);
    process.exit(2);
  }
}
