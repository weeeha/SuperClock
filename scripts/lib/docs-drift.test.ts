// Docs drift gate — the claims AGENTS.md and the entry docs make about the
// tree are checked against the tree. It catches stale NAMES and COUNTS, never
// wrong advice: a backticked path must exist, a backticked identifier must
// appear in code, a CSS token prefix must be declared, a rule id must be in the
// catalogue, an `npm run` script must be in package.json, and the app lists
// and counts in README.md, directive/foundation.md and docs/architecture.md
// must match the registry. Lineage: design-system-rebuild's
// agents-stub-provenance gate (a rule in AGENTS.md names its test or its
// reason for having none), narrowed to what this repo's docs actually claim.
//
// What is deliberately NOT read: prose words in backticks (lowercase, no
// underscore: `slow`, `grid`, `peek`), placeholders (`<id>`, `app.<id>`),
// globs (`face.*`), member expressions (`nav.peek`, `build.commit`), shell
// fragments with spaces, URLs, and absolute machine paths (`~/`, `/etc/`).

import { describe, it, expect } from 'vitest';
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { join, basename } from 'node:path';
import { fileURLToPath } from 'node:url'; // never URL.pathname — this checkout path contains spaces
import { resolve } from 'node:path';

const root = resolve(fileURLToPath(new URL('../..', import.meta.url)));
const rel = (p: string) => join(root, p);
const read = (p: string) => readFileSync(rel(p), 'utf8');

/** Names AGENTS.md is right to mention although they are not in the tree.
 *  One reason each; a name that later lands in the tree must leave this list
 *  (the stale-row test below fails otherwise). */
const NOT_IN_TREE: Record<string, string> = {
  'dist/': 'build output, gitignored',
  'server.mjs': 'the esbuild server bundle in dist/, a build artifact',
  'build-info.json': 'written into dist/ by scripts/write-build-info.mjs at build time',
  '.env': 'developer secrets, gitignored (.env.example is the tracked template)',
  'superclock.service': 'the live fleet unit name on devices provisioned before superclock-server.service existed',
  'config/fleet.json': 'device-local state, never committed (config/fleet.example.json is tracked)',
  'config/admin.json': 'device-local admin token file, never committed',
};

/** Identifiers AGENTS.md names as deleted or banned; the gate checks they stay absent. */
const MUST_NOT_EXIST_IN_CODE: Record<string, string> = {
  BackChevron: 'apps never render their own back chrome; deleted with the arc-zone gestures (PR #39)',
};

const KNOWN_DIRS = [
  'src',
  'scripts',
  'server',
  'docs',
  'config',
  'public',
  'rules',
  'slow-native',
  'admin',
  'dist',
  '.claude',
  '.github',
  'superclock-',
];
const FILE_EXT = /\.(tsx?|mjs|cjs|js|json|sh|css|md|ya?ml|html|c|h|service|py|svg|png)$/;
const CODE_ROOTS = ['src', 'scripts', 'server', 'rules', '.claude', 'slow-native'];
const CODE_FILES = [
  'eslint.config.js',
  'package.json',
  'tsconfig.app.json',
  'tsconfig.node.json',
  'vite.config.ts',
  'index.html',
];
const SKIP_DIRS = new Set(['node_modules', 'dist', '.git', 'worktrees', '__fixtures__']);

function walk(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(rel(dir), { withFileTypes: true })) {
    if (SKIP_DIRS.has(entry.name)) continue;
    const p = join(dir, entry.name);
    if (entry.isDirectory()) walk(p, out);
    else out.push(p);
  }
  return out;
}

// The corpus an identifier must appear in: code, not instructions. Excluded
// are the instruction files themselves (AGENTS.md and the path-scoped rules —
// a name mentioned only in prose is not a name the code uses), the agent log,
// and this gate, whose ledgers quote the very names it asserts absent.
const codeFiles = [...CODE_ROOTS.flatMap((d) => walk(d)), ...CODE_FILES].filter(
  (f) =>
    /\.(tsx?|mjs|cjs|js|json|sh|css|c|h|md)$/.test(f) &&
    !/AGENTS\.md|AGENT-LOG\.md|docs-drift\.test\.ts$|^\.claude\/rules\//.test(f),
);
const allBasenames = new Set(walk('.').map((f) => basename(f)));
const codeCorpus = codeFiles.map((f) => read(f)).join('\n');

function expandBraces(token: string): string[] {
  const m = /^(.*)\{([^}]+)\}(.*)$/.exec(token);
  if (!m) return [token];
  return m[2].split(',').flatMap((alt) => expandBraces(`${m[1]}${alt}${m[3]}`));
}

// The instruction corpus is AGENTS.md PLUS the path-scoped rules in
// .claude/rules/ — one contract split by scope, so a claim carries the same
// weight wherever it sits. Reading only AGENTS.md would let a rule file drift
// freely, which is precisely what the split would otherwise cost.
const instructionFiles = [
  'AGENTS.md',
  ...readdirSync(rel('.claude/rules'))
    .filter((f) => f.endsWith('.md'))
    .sort()
    .map((f) => join('.claude/rules', f)),
];
const agents = instructionFiles.map(read).join('\n');
const tokens = [...new Set([...agents.matchAll(/`([^`\n]+)`/g)].map((m) => m[1]))];

const isPathLike = (t: string) =>
  !/\s|<|\*|=|\(|\)|:/.test(t) &&
  !/^(https?:|~|\/etc|\/api|\/admin|@|\.)/.test(t) &&
  (KNOWN_DIRS.some((d) => t.startsWith(d)) || FILE_EXT.test(t)) &&
  !/^[a-z-]+\/\d+$/.test(t); // tailwind opacity classes like border-amber-400/30

const pathTokens = tokens.filter(isPathLike);
const identTokens = tokens.filter((t) => /^[A-Za-z_][A-Za-z0-9_]*$/.test(t) && /[A-Z_]/.test(t) && t.length >= 3);
const cssTokens = tokens.filter((t) => t.startsWith('--'));
const ruleIdTokens = tokens.filter((t) => /^[A-Z]{3,4}-\d+$/.test(t));
const npmTokens = tokens.filter((t) => /^npm run /.test(t));

describe('instruction files: every backticked repo path exists', () => {
  it('finds path-like claims to check', () => {
    expect(pathTokens.length).toBeGreaterThan(40);
  });

  it.each(pathTokens.filter((t) => !(t in NOT_IN_TREE)))('%s', (token) => {
    for (const candidate of expandBraces(token)) {
      if (candidate.includes('/') || candidate.endsWith('/')) {
        const p = rel(candidate);
        const ok = existsSync(p) && (!candidate.endsWith('/') || statSync(p).isDirectory());
        expect(ok, `AGENTS.md names ${candidate} but it is not in the tree`).toBe(true);
      } else {
        expect(allBasenames.has(candidate), `AGENTS.md names ${candidate} but no such file exists anywhere in the tree`).toBe(true);
      }
    }
  });

  it('every NOT_IN_TREE row is still true and still cited', () => {
    // "In the tree" means tracked by git: dist/ or .env may well exist on a
    // developer's disk, which is exactly why they are on this list.
    const tracked = execFileSync('git', ['ls-files'], { cwd: root, encoding: 'utf8' }).split('\n');
    const trackedBasenames = new Set(tracked.map((f) => basename(f)));
    for (const [name, reason] of Object.entries(NOT_IN_TREE)) {
      expect(reason.length).toBeGreaterThan(0);
      expect(tokens, `NOT_IN_TREE row '${name}' is no longer mentioned in AGENTS.md; delete it`).toContain(name);
      const bare = name.replace(/\/$/, '');
      const isTracked = name.includes('/')
        ? tracked.some((f) => f === bare || f.startsWith(`${bare}/`))
        : trackedBasenames.has(bare);
      expect(isTracked, `NOT_IN_TREE row '${name}' is now tracked by git; delete the row`).toBe(false);
    }
  });
});

describe('instruction files: every backticked identifier appears in code', () => {
  it('finds identifier claims to check', () => {
    expect(identTokens.length).toBeGreaterThan(30);
  });

  it.each(identTokens.filter((t) => !(t in MUST_NOT_EXIST_IN_CODE)))('%s', (ident) => {
    expect(codeCorpus.includes(ident), `AGENTS.md names \`${ident}\` but nothing under ${CODE_ROOTS.join(', ')} contains it`).toBe(true);
  });

  it.each(Object.entries(MUST_NOT_EXIST_IN_CODE))('%s stays deleted (%s)', (ident) => {
    expect(tokens, `MUST_NOT_EXIST row '${ident}' is no longer mentioned; delete it`).toContain(ident);
    expect(codeCorpus.includes(ident), `\`${ident}\` is back in the code although AGENTS.md says it was deleted`).toBe(false);
  });
});

describe('instruction files: tokens, rule ids and npm scripts resolve', () => {
  it.each(cssTokens)('%s is a declared CSS token prefix', (token) => {
    const prefix = token.replace(/\*.*$/, '').replace(/:.*$/, '').trim();
    // src/styles/tokens.css is the token layer the kiosk's entry stylesheet
    // imports (2026-09-06): the --face-* roles AGENTS.md and clock-faces.md
    // cite now declare there, not in src/index.css itself. src/admin/
    // index.css is listed below for its own, separately declared shadcn
    // tokens, not because it imports tokens.css: it does not yet, that is
    // sub-project 2.
    const cssFiles = ['src/index.css', 'src/admin/index.css', 'src/styles/tokens.css'];
    const css = cssFiles.map(read).join('\n');
    expect(css.includes(prefix), `${prefix} is not declared in ${cssFiles.join(' or ')}`).toBe(true);
  });

  it.each(ruleIdTokens)('%s is in the rule catalogue', (id) => {
    const ids = readdirSync(rel('rules'))
      .filter((f) => f.endsWith('.json'))
      .flatMap((f) => (JSON.parse(read(join('rules', f))) as { rules: { id: string }[] }).rules.map((r) => r.id));
    expect(ids, `AGENTS.md cites rule ${id} which rules/*.json does not define`).toContain(id);
  });

  it.each(npmTokens)('%s is a package.json script', (cmd) => {
    const script = cmd.replace(/^npm run /, '').split(' ')[0];
    const scripts = (JSON.parse(read('package.json')) as { scripts: Record<string, string> }).scripts;
    expect(scripts, `AGENTS.md cites \`${cmd}\` but package.json has no script '${script}'`).toHaveProperty(script);
  });
});

/** Registered kiosk apps, parsed from the side-import list (never hand-kept). */
const registeredApps = [...read('src/apps/index.ts').matchAll(/^import '\.\/([a-z0-9-]+)';$/gm)].map((m) => m[1]).sort();

describe('entry docs: app lists and counts match the registry', () => {
  it('README.md lists exactly the registered apps under "Built-in apps"', () => {
    const readme = read('README.md');
    const section = readme.slice(readme.indexOf('## Built-in apps'), readme.indexOf('## Tech stack'));
    const listed = [...section.matchAll(/^- `([a-z0-9-]+)`/gm)].map((m) => m[1]).sort();
    expect(listed).toEqual(registeredApps);
  });

  it('README.md documents the server-side GITHUB_TOKEN, not a browser-inlined VITE_ token', () => {
    const readme = read('README.md');
    expect(readme).not.toContain('VITE_GITHUB_TOKEN');
    expect(readme).toContain('GITHUB_TOKEN');
    expect(readme).not.toMatch(/falls back to mock/i);
  });

  it.each(['directive/foundation.md', 'docs/architecture.md'])('%s states the current app count', (doc) => {
    const m = /(\d+) apps registered/.exec(read(doc));
    expect(m, `${doc} no longer states an app count`).not.toBeNull();
    expect(Number(m![1]), `${doc} says ${m![1]} apps registered; the registry has ${registeredApps.length}`).toBe(
      registeredApps.length,
    );
  });
});
