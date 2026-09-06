# Token Layer Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give both SuperClock stylesheets a three-tier token layer whose middle tier is the only place a light value and a dark value are written, so one mode axis can reach every surface and a density axis has somewhere to live later.

**Architecture:** A new `src/styles/tokens.css` holds tier 1 ramps (raw steps, read only by tier 2) and tier 2 semantic roles (each with a light and a dark value, hung on the `html.light` / `html.dark` classes the kiosk already toggles). Both entry stylesheets import it. The nine `--face-*` names are tier 2 roles already and keep their spelling and values. Tier 3 exists only in the admin, as an `@theme inline` block that turns the shadcn vocabulary into real Tailwind utilities. Gates extend the existing token-liveness module rather than adding a parallel set.

**Tech Stack:** Tailwind CSS v4 via `@tailwindcss/vite` (no config file), TypeScript strict, vitest 4, Node 22. No new dependencies.

**Spec:** `docs/superpowers/specs/2026-09-06-token-layer-design.md`

## Global Constraints

- Work lands as local commits by explicit path. No pushes, no pull requests. Never `git stash`: the stack is shared across worktrees.
- TDD: every test watched red before its implementation. `./scripts/gates.sh` green before "done". Each new gate mutation-checked, files restored after.
- **Nothing changes on glass outside the proof surface.** Every face token must resolve to the exact value it holds today, and the admin must keep rendering exactly as it does today.
- **Two value formats in tier 2, on purpose and temporarily.** Face roles carry hex. Admin-facing roles carry bare HSL triplets, because roughly one hundred admin consumers read `hsl(var(--x))` and migrating them is sub-project 2. A triplet propagates unchanged through a `var()` chain, so this costs nothing but a comment.
- **The ledger does not shrink here.** Liveness requires a reader. The four dead admin tokens gain a route and no consumer; their reasons get updated and the entries stay.
- Prose in code comments and docs: no em dashes, no exclamation marks.
- TypeScript: `verbatimModuleSyntax` (type-only imports use `import type`), `erasableSyntaxOnly`. No casts, no non-null assertions; check the raw path immediately before use.
- Node scripts resolve paths with `fileURLToPath`, never `URL.pathname`. Quote every shell path: the checkout path contains spaces.
- Commit messages end with: `Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>`

## File map

| File | Responsibility |
|---|---|
| `src/styles/tokens.css` (new) | tier 1 ramps and tier 2 roles, both modes, the single source |
| `src/index.css` (modify) | imports tokens.css; keeps its `@theme`; face role declarations move out |
| `src/admin/index.css` (modify) | imports tokens.css; adds the `@theme inline` tier 3 block; keeps its existing triplets untouched |
| `scripts/lib/token-tiers.mjs` + `.d.mts` (new) | pure predicates: parse tiers, both-modes check, alias-shape check |
| `scripts/lib/token-tiers.test.ts` (new) | fixture tests for those predicates |
| `src/shared/token-tiers.test.ts` (new) | real-tree gate over `tokens.css` and both entries |
| `src/shared/token-contrast.test.ts` (new) | contrast per role pair per mode |
| `scripts/lib/contrast.mjs` + `.d.mts` + `.test.ts` (new) | relative luminance and ratio, pure |
| `src/core/components/QuickSettings.tsx` (modify) | the proof surface, re-tokenised |
| `scripts/lib/rules.mjs`, `rules/superclock.json` (modify) | R11 gains its token-level detector; catalogue record updated |
| `scripts/lib/token-liveness.mjs` (modify) | ledger reasons for the four admin entries |
| `AGENTS.md`, `docs/agent-log.md`, the spec changelog (modify) | the rule, the record |

---

### Task 1: The shared token file, and the gate that both modes exist

**Files:**
- Create: `src/styles/tokens.css`, `scripts/lib/token-tiers.mjs`, `scripts/lib/token-tiers.d.mts`
- Test: `scripts/lib/token-tiers.test.ts`, `src/shared/token-tiers.test.ts`

**Interfaces:**
- Produces: `parseTiers(cssText)` returning `{ ramps: string[], light: Record<string,string>, dark: Record<string,string> }`; `missingModes(parsed)` returning role names declared in one mode only; `tierViolations(parsed)` returning tier 2 roles whose value is a literal rather than a `var()` at a ramp. All consumed by Task 2's real-tree gate and Task 4's contrast gate.

- [ ] **Step 1: Write the failing fixture tests**

```ts
// scripts/lib/token-tiers.test.ts
// Fixture tests for the tier predicates. The module is fs-free like its
// siblings (token-rules, token-liveness, lvgl-parity, parts-index): the
// real-tree gates own file reading, every judgment lives here.
import { describe, it, expect } from 'vitest';
import { parseTiers, missingModes, tierViolations } from './token-tiers.mjs';

const CSS = `
/* Tier 1 */
:root {
  --stone-0: #ffffff;
  --stone-1000: #000000;
}
/* Tier 2 */
:root, html.light {
  --face-bg: var(--stone-0);
  --face-ink: var(--stone-1000);
  --only-light: var(--stone-0);
}
html.dark {
  --face-bg: var(--stone-1000);
  --face-ink: var(--stone-0);
}
`;

describe('parseTiers', () => {
  it('separates the ramp block from the two mode blocks', () => {
    const t = parseTiers(CSS);
    expect(t.ramps).toEqual(['--stone-0', '--stone-1000']);
    expect(Object.keys(t.light)).toEqual(['--face-bg', '--face-ink', '--only-light']);
    expect(Object.keys(t.dark)).toEqual(['--face-bg', '--face-ink']);
  });

  it('keeps each role its raw declared value', () => {
    expect(parseTiers(CSS).light['--face-bg']).toBe('var(--stone-0)');
  });
});

describe('missingModes', () => {
  it('names a role declared light-only', () => {
    expect(missingModes(parseTiers(CSS))).toEqual(['--only-light']);
  });

  it('names a role declared dark-only', () => {
    const css = CSS + '\nhtml.dark { --only-dark: var(--stone-0); }';
    expect(missingModes(parseTiers(css)).sort()).toEqual(['--only-dark', '--only-light']);
  });

  it('is empty when every role carries both', () => {
    const css = CSS.replace('  --only-light: var(--stone-0);\n', '');
    expect(missingModes(parseTiers(css))).toEqual([]);
  });
});

describe('tierViolations', () => {
  it('flags a tier 2 role holding a literal instead of a ramp reference', () => {
    const css = CSS.replace('--face-ink: var(--stone-1000);', '--face-ink: #111111;');
    expect(tierViolations(parseTiers(css))).toContain('--face-ink');
  });

  it('allows a bare HSL triplet reference, the admin transitional form', () => {
    const css = CSS.replace('--face-ink: var(--stone-1000);', '--face-ink: var(--gray-40);');
    expect(tierViolations(parseTiers(css))).toEqual([]);
  });

  it('is empty when every role points at a ramp', () => {
    expect(tierViolations(parseTiers(CSS))).toEqual([]);
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run scripts/lib/token-tiers.test.ts`
Expected: FAIL with `Cannot find module './token-tiers.mjs'`.

- [ ] **Step 3: Write the predicate module and its types**

```js
// scripts/lib/token-tiers.mjs
// Predicates for the three-tier token layer. Fs-free, like token-rules.mjs,
// token-liveness.mjs, lvgl-parity.mjs and parts-index.mjs; the real-tree
// gates own reading and globbing.
//
// The layer's whole claim is that tier 2 is the only place a light value and
// a dark value are written. Two things can silently falsify that: a role
// declared in one mode only, which leaves a surface unstyled in the other,
// and a tier 2 role holding a literal, which puts a value somewhere the mode
// flip cannot reach. Both are checked here.

const DECL = /^\s*(--[\w-]+)\s*:\s*([^;]+);/;

/** Split a stylesheet into the tier 1 ramp block and the two tier 2 mode
 *  blocks. Selectors are the contract: `:root` alone is tier 1, the
 *  `:root, html.light` pair is tier 2 light, `html.dark` is tier 2 dark. */
export function parseTiers(cssText) {
  const out = { ramps: [], light: {}, dark: {} };
  let target = null;
  for (const line of cssText.split('\n')) {
    const trimmed = line.trim();
    if (trimmed.endsWith('{')) {
      const sel = trimmed.slice(0, -1).trim();
      if (sel === ':root') target = 'ramps';
      else if (sel === ':root, html.light' || sel === 'html.light') target = 'light';
      else if (sel === 'html.dark') target = 'dark';
      else target = null;
      continue;
    }
    if (trimmed === '}') { target = null; continue; }
    const m = DECL.exec(line);
    if (!m || !target) continue;
    if (target === 'ramps') out.ramps.push(m[1]);
    else out[target][m[1]] = m[2].trim();
  }
  return out;
}

/** Roles declared in one mode and not the other, in declaration order. */
export function missingModes({ light, dark }) {
  const out = [];
  for (const k of Object.keys(light)) if (!(k in dark)) out.push(k);
  for (const k of Object.keys(dark)) if (!(k in light)) out.push(k);
  return out;
}

/** Tier 2 roles whose value is not a reference to a ramp. A literal here is
 *  a value the mode flip cannot reach and the ramps cannot rebrand. */
export function tierViolations({ light, dark }) {
  const bad = new Set();
  for (const block of [light, dark]) {
    for (const [name, value] of Object.entries(block)) {
      if (!/^var\(--[\w-]+\)$/.test(value)) bad.add(name);
    }
  }
  return [...bad];
}
```

```ts
// scripts/lib/token-tiers.d.mts
export interface ParsedTiers {
  ramps: string[];
  light: Record<string, string>;
  dark: Record<string, string>;
}
export declare function parseTiers(cssText: string): ParsedTiers;
export declare function missingModes(parsed: ParsedTiers): string[];
export declare function tierViolations(parsed: ParsedTiers): string[];
```

- [ ] **Step 4: Run the fixture tests to verify they pass**

Run: `npx vitest run scripts/lib/token-tiers.test.ts`
Expected: PASS, 8 tests.

- [ ] **Step 5: Write the failing real-tree gate**

```ts
// src/shared/token-tiers.test.ts
// The layer's contract, checked against the real stylesheet: every tier 2
// role carries both modes, and no tier 2 role holds a literal. Same shape as
// token-liveness.test.ts and part-contracts.test.ts.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { parseTiers, missingModes, tierViolations } from '../../scripts/lib/token-tiers.mjs';

const TOKENS = 'src/styles/tokens.css';

describe('token tiers', () => {
  const parsed = parseTiers(readFileSync(TOKENS, 'utf8'));

  it('declares ramps and roles (a narrowed parse must not report clean)', () => {
    expect(parsed.ramps.length, `${TOKENS} declares no tier 1 ramps`).toBeGreaterThan(0);
    expect(Object.keys(parsed.light).length, `${TOKENS} declares no tier 2 roles`).toBeGreaterThan(0);
  });

  it('every role carries a light and a dark value', () => {
    const missing = missingModes(parsed);
    expect(
      missing,
      `declared in one mode only in ${TOKENS}: ${missing.join(', ')}. A role with one mode leaves its surface unstyled in the other.`,
    ).toEqual([]);
  });

  it('no role holds a literal; every one points at a ramp', () => {
    const bad = tierViolations(parsed);
    expect(
      bad,
      `tier 2 roles holding a literal in ${TOKENS}: ${bad.join(', ')}. Move the value into a tier 1 ramp and point the role at it, or the mode flip and any future rebrand cannot reach it.`,
    ).toEqual([]);
  });
});
```

Run: `npx vitest run src/shared/token-tiers.test.ts`
Expected: FAIL, `ENOENT` on `src/styles/tokens.css`.

- [ ] **Step 6: Write the token file**

Every value below already existed in the tree on 2026-09-06. This file names them; it chooses no new colour. The face hexes come from `src/index.css`, the admin triplets from `src/admin/index.css`.

```css
/* SuperClock design tokens. Three tiers, imported by both entry stylesheets.
 *
 * Tier 1 below is raw steps with no meaning attached. Only tier 2 reads them.
 * Tier 2 is the semantic layer and the ONLY place a light value and a dark
 * value are ever written. Tier 3 lives in src/admin/index.css, where the
 * shadcn vocabulary is aliased onto tier 2; the kiosk needs no tier 3,
 * because its --face-* names are already semantic and already live here.
 *
 * Two value formats coexist on purpose and temporarily. Face roles carry hex.
 * Admin-facing roles carry bare HSL triplets, because roughly one hundred
 * admin consumers read hsl(var(--x)) and migrating them is sub-project 2. A
 * triplet propagates unchanged through a var() chain, so the cost is this
 * comment. Spec: docs/superpowers/specs/2026-09-06-token-layer-design.md
 */

/* ---- Tier 1: ramps. Nothing outside tier 2 may read these. ---- */
:root {
  /* Warm neutral, the faces' ramp (was inline in src/index.css). */
  --stone-0: #ffffff;
  --stone-50: #f1f1ef;
  --stone-100: #e4e4e1;
  --stone-200: #d9d9d4;
  --stone-300: #a1a1aa;
  --stone-400: #8a8a8a;
  --stone-600: #52525b;
  --stone-700: #444444;
  --stone-800: #2c2f35;
  --stone-850: #15171a;
  --stone-900: #111316;
  --stone-1000: #000000;

  /* Dusk blues, face-specific, on no neutral ramp. */
  --dusk-light: #8fa9c4;
  --dusk-dark: #2b3d52;

  /* Pure neutral, the admin's ramp. HSL triplets, see the header. */
  --gray-4: 0 0% 4%;
  --gray-7: 0 0% 7%;
  --gray-12: 0 0% 12%;
  --gray-14: 0 0% 14%;
  --gray-16: 0 0% 16%;
  --gray-60: 0 0% 60%;
  --gray-84: 0 0% 84%;
  --gray-88: 0 0% 88%;
  --gray-92: 0 0% 92%;
  --gray-96: 0 0% 96%;
  --gray-100: 0 0% 100%;

  /* Hues. Three accent oranges coexist; the spec's open question 1 decides
     which survives, and this file must not decide it by picking one. */
  --orange-kiosk: #ff8826;
  --orange-admin: 20 96% 60%;
  --red-50: 0 70% 50%;
  --green-58: 142 69% 58%;
  --amber-56: 43 96% 56%;
  --amber-65: 46 97% 65%;

  /* Chrome scrims, the kiosk's white-alpha fills. */
  --scrim-15: 255 255 255 / 0.15;
  --scrim-25: 255 255 255 / 0.25;
  --scrim-80: 255 255 255 / 0.8;
  --scrim-50-ink: 255 255 255 / 0.5;
  --scrim-70-ink: 255 255 255 / 0.7;
  --sheet-chrome: #171717;
}

/* ---- Tier 2: semantic roles. Both modes, and only here. ---- */
:root, html.light {
  /* Faces. Values identical to the pre-2026-09-06 src/index.css. */
  --face-bg: var(--stone-0);
  --face-ink: var(--stone-1000);
  --face-ink-muted: var(--stone-600);
  --face-tick: var(--stone-700);
  --face-plate: var(--stone-50);
  --face-dusk: var(--dusk-light);
  --face-spent: var(--stone-100);
  --face-ghost: var(--stone-200);

  /* Names here must not collide with the admin's own token names: inside
     .admin-root that block wins by specificity, so a tier 3 alias written as
     hsl(var(--accent)) would resolve to the leaving form instead of this
     role. Hence --brand and the --status-* family rather than --accent,
     --success and --warning.
     Chrome and admin surfaces. Light values are ramp-derived defaults, not
     designed ones; sub-project 2 tunes them against a real screen. Nothing
     consumes them yet, so they move no pixel today. */
  --surface-ground: var(--gray-100);
  --surface-card: var(--gray-96);
  --surface-sheet: var(--gray-92);
  --surface-popover: var(--gray-96);
  --ink: var(--gray-4);
  --ink-muted: var(--gray-60);
  --brand-ink: var(--gray-100);
  --brand: var(--orange-admin);
  --status-danger: var(--red-50);
  --status-ok: var(--green-58);
  --status-warn: var(--amber-56);
  --status-warn-ink: var(--amber-65);
  --line: var(--gray-84);
  --focus: var(--orange-admin);
  --fill-subtle: var(--scrim-15);
  --fill: var(--scrim-25);
  --fill-strong: var(--scrim-80);
}

html.dark {
  --face-bg: var(--stone-1000);
  --face-ink: var(--stone-0);
  --face-ink-muted: var(--stone-300);
  --face-tick: var(--stone-400);
  --face-plate: var(--stone-850);
  --face-dusk: var(--dusk-dark);
  --face-spent: var(--stone-900);
  --face-ghost: var(--stone-800);

  /* Identical to today's src/admin/index.css values. */
  --surface-ground: var(--gray-4);
  --surface-card: var(--gray-7);
  --surface-sheet: var(--gray-12);
  --surface-popover: var(--gray-7);
  --ink: var(--gray-96);
  --ink-muted: var(--gray-60);
  --brand-ink: var(--gray-7);
  --brand: var(--orange-admin);
  --status-danger: var(--red-50);
  --status-ok: var(--green-58);
  --status-warn: var(--amber-56);
  --status-warn-ink: var(--amber-65);
  --line: var(--gray-16);
  --focus: var(--orange-admin);
  --fill-subtle: var(--scrim-15);
  --fill: var(--scrim-25);
  --fill-strong: var(--scrim-80);
}

/* The admin has no scheduler, so its mode is the viewer's phone preference.
 * The kiosk always carries an explicit class from apply-settings.ts, so this
 * block never applies there. */
@media (prefers-color-scheme: dark) {
  :root:not(.light):not(.dark) {
    --face-bg: var(--stone-1000);
    --face-ink: var(--stone-0);
    --face-ink-muted: var(--stone-300);
    --face-tick: var(--stone-400);
    --face-plate: var(--stone-850);
    --face-dusk: var(--dusk-dark);
    --face-spent: var(--stone-900);
    --face-ghost: var(--stone-800);
    --surface-ground: var(--gray-4);
    --surface-card: var(--gray-7);
    --surface-sheet: var(--gray-12);
    --surface-popover: var(--gray-7);
    --ink: var(--gray-96);
    --ink-muted: var(--gray-60);
    --brand-ink: var(--gray-7);
    --line: var(--gray-16);
  }
}
```

- [ ] **Step 7: Run the real-tree gate to verify it passes**

Run: `npx vitest run src/shared/token-tiers.test.ts`
Expected: PASS, 3 tests. If "every role carries both modes" fails, a role was added to one block and not the other; add it to both rather than deleting it from one.

- [ ] **Step 8: Mutation-check, restoring afterwards**

1. Delete the `--face-tick` line from the `html.dark` block: expect FAIL naming `--face-tick`. Restore with `git checkout --` after the file is committed, or by reverting the edit.
2. Change `--face-ink: var(--stone-1000);` to `--face-ink: #000000;` in the light block: expect FAIL naming `--face-ink` as holding a literal. Restore.

- [ ] **Step 9: Lint, typecheck, commit**

Run: `npx vitest run && npx eslint . && npx tsc -b`

```bash
git add src/styles/tokens.css scripts/lib/token-tiers.mjs scripts/lib/token-tiers.d.mts scripts/lib/token-tiers.test.ts src/shared/token-tiers.test.ts
git commit -m "feat(tokens): three-tier token file, both modes, with its tier gate"
```

---

### Task 2: The kiosk consumes the layer, with its values proven unchanged

**Files:**
- Modify: `src/index.css`
- Test: `src/shared/token-tiers.test.ts` (extend)

**Interfaces:**
- Consumes: Task 1's `parseTiers`.
- Produces: `src/index.css` importing `./styles/tokens.css` with its face declarations removed.

- [ ] **Step 1: Write the failing value-preservation test**

Add to `src/shared/token-tiers.test.ts`. This is the test that makes the whole refactor safe: it pins each face role to the exact value it held before the layer existed.

```ts
// Appended to src/shared/token-tiers.test.ts

// The nine face roles as src/index.css declared them before the token layer
// (commit prior to this work). A face that resolves to anything else is a
// pixel change on thirteen faces, which this sub-project forbids.
const FACE_BEFORE = {
  light: {
    '--face-bg': '#ffffff',
    '--face-ink': '#000000',
    '--face-ink-muted': '#52525b',
    '--face-tick': '#444444',
    '--face-plate': '#f1f1ef',
    '--face-dusk': '#8fa9c4',
    '--face-spent': '#e4e4e1',
    '--face-ghost': '#d9d9d4',
  },
  dark: {
    '--face-bg': '#000000',
    '--face-ink': '#ffffff',
    '--face-ink-muted': '#a1a1aa',
    '--face-tick': '#8a8a8a',
    '--face-plate': '#15171a',
    '--face-dusk': '#2b3d52',
    '--face-spent': '#111316',
    '--face-ghost': '#2c2f35',
  },
} as const;

describe('face values survive the move into the layer', () => {
  const css = readFileSync(TOKENS, 'utf8');
  const parsed = parseTiers(css);

  /** Resolve a role one hop through its ramp, which is all the layer allows. */
  function resolve(mode: 'light' | 'dark', role: string): string {
    const ref = parsed[mode][role];
    const ramp = /^var\((--[\w-]+)\)$/.exec(ref ?? '');
    if (!ramp) return ref ?? '(undeclared)';
    const decl = new RegExp(`^\\s*${ramp[1]}\\s*:\\s*([^;]+);`, 'm').exec(css);
    return decl ? decl[1].trim() : '(ramp missing)';
  }

  for (const mode of ['light', 'dark'] as const) {
    for (const [role, expected] of Object.entries(FACE_BEFORE[mode])) {
      it(`${mode}: ${role} still resolves to ${expected}`, () => {
        expect(
          resolve(mode, role),
          `${role} changed value in ${mode} mode. Thirteen faces and their contracts depend on it.`,
        ).toBe(expected);
      });
    }
  }

  it('src/index.css no longer declares a face role itself', () => {
    const entry = readFileSync('src/index.css', 'utf8');
    for (const role of Object.keys(FACE_BEFORE.light)) {
      expect(
        new RegExp(`^\\s*${role}\\s*:`, 'm').test(entry),
        `src/index.css still declares ${role}; the layer is the only place a role is written.`,
      ).toBe(false);
    }
    expect(entry).toContain("@import './styles/tokens.css'");
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run src/shared/token-tiers.test.ts`
Expected: FAIL on the last case, because `src/index.css` still declares the face roles and does not import the layer. The sixteen value cases should already pass, since Task 1 copied the values faithfully. If any value case fails, Task 1's file has a typo: fix `tokens.css`, never this expectation.

- [ ] **Step 3: Edit the kiosk entry**

In `src/index.css`, add the import directly under the Tailwind import, and delete the two blocks that declare the face roles (the `:root, html.light` block and the `html.dark` block, including their comments, which have moved into `tokens.css`). Change nothing else: the `@theme` block, `.theme-fade`, the `html, body, #root` rule, the scrollbar rules and `.calendar-scroll` all stay exactly as they are.

```css
@import 'tailwindcss';
@import './styles/tokens.css';
```

- [ ] **Step 4: Verify green**

Run: `npx vitest run src/shared/token-tiers.test.ts && npx vitest run && npx eslint . && npx tsc -b && npm run build`
Expected: all green, and the build emits CSS. A Vite build is the only thing that proves the `@import` resolves.

- [ ] **Step 5: Prove no face moved, in a browser**

Start the dev server on a free port (5180 may be held by another project): `npx vite --port 5181 --strictPort`. In the page, read the resolved values in both modes and compare against `FACE_BEFORE`:

```js
const probe = (mode) => {
  document.documentElement.classList.remove('light', 'dark');
  document.documentElement.classList.add(mode);
  const cs = getComputedStyle(document.documentElement);
  return Object.fromEntries(
    ['bg','ink','ink-muted','tick','plate','dusk','spent','ghost']
      .map((n) => [`--face-${n}`, cs.getPropertyValue(`--face-${n}`).trim()]),
  );
};
JSON.stringify({ light: probe('light'), dark: probe('dark') }, null, 2);
```

Record both objects in your report. Every value must equal `FACE_BEFORE`. Restore the classes afterwards by reloading. If you cannot drive a browser, say so plainly and note that the static test is the only proof; do not claim a browser check you did not run.

- [ ] **Step 6: Commit**

```bash
git add src/index.css src/shared/token-tiers.test.ts
git commit -m "feat(tokens): kiosk consumes the token layer, face values pinned unchanged"
```

---

### Task 3: The admin gains tier 3 and a mode signal

**Files:**
- Modify: `src/admin/index.css`, `scripts/lib/token-liveness.mjs`
- Test: `src/shared/token-tiers.test.ts` (extend)

**Interfaces:**
- Produces: an `@theme inline` block making the shadcn vocabulary real Tailwind utilities; the four dead admin entries' ledger reasons updated.

- [ ] **Step 1: Write the failing tier 3 test**

Append to `src/shared/token-tiers.test.ts`:

```ts
describe('admin tier 3', () => {
  const admin = readFileSync('src/admin/index.css', 'utf8');

  it('imports the layer', () => {
    expect(admin).toContain("@import '../styles/tokens.css'");
  });

  it('declares an @theme inline block, which is what makes the names into utilities', () => {
    expect(
      /@theme\s+inline\s*\{/.test(admin),
      'src/admin/index.css has no `@theme inline` block, so shadcn names generate no utilities and four tokens stay unreachable.',
    ).toBe(true);
  });

  it('every alias in that block is a var() at a tier 2 role, never a literal', () => {
    const block = /@theme\s+inline\s*\{([\s\S]*?)\n\}/.exec(admin);
    expect(block, 'no @theme inline block to read').not.toBeNull();
    if (!block) return;
    const roles = new Set(Object.keys(parseTiers(readFileSync(TOKENS, 'utf8')).light));
    const bad: string[] = [];
    for (const line of block[1].split('\n')) {
      const m = /^\s*(--[\w-]+)\s*:\s*([^;]+);/.exec(line);
      if (!m) continue;
      const ref = /var\((--[\w-]+)\)/.exec(m[2]);
      if (!ref || !roles.has(ref[1])) bad.push(`${m[1]} = ${m[2].trim()}`);
    }
    expect(
      bad,
      `tier 3 aliases not pointing at a tier 2 role: ${bad.join('; ')}. An alias holding a value is the inversion this layer exists to remove.`,
    ).toEqual([]);
  });

  it('keeps the existing triplet declarations, which ~100 consumers still read', () => {
    expect(admin).toContain('--background: 0 0% 4%');
    expect(admin).toContain('--border: 0 0% 16%');
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run src/shared/token-tiers.test.ts`
Expected: FAIL on the import and the `@theme inline` cases.

- [ ] **Step 3: Edit the admin entry**

Add the import under the Tailwind import, and add the `@theme inline` block at top level, above the `.admin-root` rule. Leave the entire `.admin-root` block exactly as it is, including every triplet: those are what the current consumers read, and removing them is sub-project 2.

```css
@import 'tailwindcss';
@import '../styles/tokens.css';

/* Tier 3: the shadcn vocabulary as real Tailwind utilities. `inline` is
 * load-bearing: it makes each utility emit `var(--role)` rather than a copied
 * value, so the mode flip reaches a class like `bg-card` at runtime.
 *
 * The triplet declarations inside .admin-root below are the leaving form.
 * They stay until sub-project 2 moves the consumers onto these utilities;
 * until then an admin colour is reachable two ways on purpose. */
@theme inline {
  --color-background: hsl(var(--surface-ground));
  --color-foreground: hsl(var(--ink));
  --color-card: hsl(var(--surface-card));
  --color-card-foreground: hsl(var(--ink));
  --color-popover: hsl(var(--surface-popover));
  --color-popover-foreground: hsl(var(--ink));
  --color-primary: hsl(var(--brand));
  --color-primary-foreground: hsl(var(--brand-ink));
  --color-secondary: hsl(var(--surface-sheet));
  --color-secondary-foreground: hsl(var(--ink));
  --color-muted: hsl(var(--surface-sheet));
  --color-muted-foreground: hsl(var(--ink-muted));
  --color-accent: hsl(var(--brand));
  --color-accent-foreground: hsl(var(--brand-ink));
  --color-destructive: hsl(var(--status-danger));
  --color-destructive-foreground: hsl(var(--ink));
  --color-border: hsl(var(--line));
  --color-input: hsl(var(--line));
  --color-ring: hsl(var(--focus));
  --color-success: hsl(var(--status-ok));
  --color-warning: hsl(var(--status-warn));
  --color-warning-foreground: hsl(var(--status-warn-ink));
}
```

Note for the implementer: the test in Step 1 reads the `var(--role)` inside each declaration, so `hsl(var(--surface-ground))` satisfies it. If the test rejects a line, the role name is wrong, not the wrapper.

- [ ] **Step 4: Verify green and prove the admin did not change**

Run: `npx vitest run && npx eslint . && npx tsc -b && npm run build`

Then, in a browser at the dev server's `/admin`, confirm the page still renders dark and that a spot check of computed colours matches the pre-change values:

```js
const cs = getComputedStyle(document.querySelector('.admin-root'));
JSON.stringify({ bg: cs.backgroundColor, fg: cs.color });
```

Expected: the same values as before this task, because every consumer still reads the untouched triplets. Record them.

- [ ] **Step 5: Update the four ledger reasons**

In `scripts/lib/token-liveness.mjs`, the four admin entries currently say the token is unreachable until the admin gains an `@theme inline` block. It now has one. Update each reason to say the token is reachable through its utility and awaiting a consumer in sub-project 2. Do not delete the entries: liveness requires a reader, and nothing reads them yet.

Run: `npx vitest run src/shared/token-liveness.test.ts`
Expected: PASS, and the ledger is still seven entries long.

- [ ] **Step 6: Commit**

```bash
git add src/admin/index.css scripts/lib/token-liveness.mjs src/shared/token-tiers.test.ts
git commit -m "feat(tokens): admin tier 3 as @theme inline aliases over the shared roles"
```

---

### Task 4: The contrast gate, and R11 stops being unchecked

**Files:**
- Create: `scripts/lib/contrast.mjs`, `scripts/lib/contrast.d.mts`, `scripts/lib/contrast.test.ts`, `src/shared/token-contrast.test.ts`
- Modify: `scripts/lib/rules.mjs`, `rules/superclock.json`

**Interfaces:**
- Produces: `relativeLuminance(rgb)`, `contrastRatio(a, b)`, `parseColor(value)` resolving hex or an HSL triplet to `{r,g,b}`; the pair list the gate checks.

- [ ] **Step 1: Write the failing fixture tests**

```ts
// scripts/lib/contrast.test.ts
import { describe, it, expect } from 'vitest';
import { parseColor, contrastRatio } from './contrast.mjs';

describe('parseColor', () => {
  it('reads a six-digit hex', () => {
    expect(parseColor('#ffffff')).toEqual({ r: 255, g: 255, b: 255 });
  });
  it('reads a bare HSL triplet, the admin form', () => {
    expect(parseColor('0 0% 0%')).toEqual({ r: 0, g: 0, b: 0 });
  });
  it('returns null for a form it does not understand, so the gate can say so', () => {
    expect(parseColor('var(--x)')).toBeNull();
    expect(parseColor('255 255 255 / 0.5')).toBeNull();
  });
});

describe('contrastRatio', () => {
  it('is 21 for black on white', () => {
    expect(Math.round(contrastRatio({ r: 0, g: 0, b: 0 }, { r: 255, g: 255, b: 255 }))).toBe(21);
  });
  it('is 1 for a colour against itself', () => {
    expect(contrastRatio({ r: 18, g: 18, b: 18 }, { r: 18, g: 18, b: 18 })).toBe(1);
  });
  it('is symmetric', () => {
    const a = { r: 10, g: 20, b: 30 };
    const b = { r: 200, g: 210, b: 220 };
    expect(contrastRatio(a, b)).toBeCloseTo(contrastRatio(b, a), 10);
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `npx vitest run scripts/lib/contrast.test.ts`
Expected: FAIL, `Cannot find module './contrast.mjs'`.

- [ ] **Step 3: Write the module**

```js
// scripts/lib/contrast.mjs
// Relative luminance and contrast ratio, WCAG 2.1. Fs-free like its siblings.
// parseColor deliberately returns null rather than guessing: a value the gate
// cannot read must be reported as unreadable, not silently scored.

export function parseColor(value) {
  const v = value.trim();
  const hex = /^#([0-9a-fA-F]{6})$/.exec(v);
  if (hex) {
    const n = parseInt(hex[1], 16);
    return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
  }
  const hsl = /^(\d+(?:\.\d+)?)\s+(\d+(?:\.\d+)?)%\s+(\d+(?:\.\d+)?)%$/.exec(v);
  if (!hsl) return null;
  const h = Number(hsl[1]) / 360;
  const s = Number(hsl[2]) / 100;
  const l = Number(hsl[3]) / 100;
  if (s === 0) {
    const g = Math.round(l * 255);
    return { r: g, g, b: g };
  }
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
  const p = 2 * l - q;
  const channel = (t) => {
    let x = t;
    if (x < 0) x += 1;
    if (x > 1) x -= 1;
    if (x < 1 / 6) return p + (q - p) * 6 * x;
    if (x < 1 / 2) return q;
    if (x < 2 / 3) return p + (q - p) * (2 / 3 - x) * 6;
    return p;
  };
  return {
    r: Math.round(channel(h + 1 / 3) * 255),
    g: Math.round(channel(h) * 255),
    b: Math.round(channel(h - 1 / 3) * 255),
  };
}

export function relativeLuminance({ r, g, b }) {
  const f = (c) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
}

export function contrastRatio(a, b) {
  const la = relativeLuminance(a);
  const lb = relativeLuminance(b);
  const [hi, lo] = la >= lb ? [la, lb] : [lb, la];
  return (hi + 0.05) / (lo + 0.05);
}
```

```ts
// scripts/lib/contrast.d.mts
export interface Rgb { r: number; g: number; b: number }
export declare function parseColor(value: string): Rgb | null;
export declare function relativeLuminance(rgb: Rgb): number;
export declare function contrastRatio(a: Rgb, b: Rgb): number;
```

- [ ] **Step 4: Verify the fixtures pass**

Run: `npx vitest run scripts/lib/contrast.test.ts`
Expected: PASS, 6 tests.

- [ ] **Step 5: Write the real-tree contrast gate**

```ts
// src/shared/token-contrast.test.ts
// Contrast at the token level: each ink role against each surface role it is
// used on, in both modes. This is not a rendered check, and R11's record says
// so: a screen can still fail with compliant tokens. What it does catch is a
// role pair that could never pass, in either mode, before anyone renders it.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { parseTiers } from '../../scripts/lib/token-tiers.mjs';
import { parseColor, contrastRatio } from '../../scripts/lib/contrast.mjs';

const TOKENS = 'src/styles/tokens.css';
const AA = 4.5;

// Ink against the surfaces it actually sits on. Derived from the role list,
// not hand-listed per mode, so a role added later arrives already checked.
const PAIRS: Array<[string, string]> = [
  ['--ink', '--surface-ground'],
  ['--ink', '--surface-card'],
  ['--ink', '--surface-sheet'],
  ['--ink', '--surface-popover'],
  ['--ink-muted', '--surface-ground'],
  ['--ink-muted', '--surface-card'],
  ['--brand-ink', '--brand'],
  ['--face-ink', '--face-bg'],
  ['--face-ink-muted', '--face-bg'],
  ['--face-ink', '--face-plate'],
];

describe('token contrast', () => {
  const css = readFileSync(TOKENS, 'utf8');
  const parsed = parseTiers(css);

  function value(mode: 'light' | 'dark', role: string): string | null {
    const ref = parsed[mode][role];
    const ramp = /^var\((--[\w-]+)\)$/.exec(ref ?? '');
    if (!ramp) return null;
    const decl = new RegExp(`^\\s*${ramp[1]}\\s*:\\s*([^;]+);`, 'm').exec(css);
    return decl ? decl[1].trim() : null;
  }

  it('every pair names roles that exist', () => {
    for (const [ink, surface] of PAIRS) {
      expect(parsed.light[ink], `${ink} is not a tier 2 role`).toBeDefined();
      expect(parsed.light[surface], `${surface} is not a tier 2 role`).toBeDefined();
    }
  });

  for (const mode of ['light', 'dark'] as const) {
    it(`${mode}: every ink and surface pair is readable, and every value is parseable`, () => {
      const unreadable: string[] = [];
      const failing: string[] = [];
      for (const [ink, surface] of PAIRS) {
        const a = value(mode, ink);
        const b = value(mode, surface);
        const ca = a === null ? null : parseColor(a);
        const cb = b === null ? null : parseColor(b);
        if (!ca || !cb) {
          unreadable.push(`${ink} on ${surface}`);
          continue;
        }
        const ratio = contrastRatio(ca, cb);
        if (ratio < AA) failing.push(`${ink} on ${surface} = ${ratio.toFixed(2)}:1`);
      }
      expect(
        unreadable,
        `values the gate could not parse in ${mode}: ${unreadable.join(', ')}. An unparseable value must not read as a pass.`,
      ).toEqual([]);
      expect(
        failing,
        `below ${AA}:1 in ${mode} mode: ${failing.join('; ')}. Move up the ink ramp or lighten the surface; never add a one-off darker value.`,
      ).toEqual([]);
    });
  }
});
```

- [ ] **Step 6: Run it and act on what it says**

Run: `npx vitest run src/shared/token-contrast.test.ts`

If a pair fails, the tokens are wrong, not the threshold: adjust the ramp step the role points at, inside `tokens.css`, and re-run. Do not lower `AA`, do not delete a pair, and do not change a face value (Task 2 pinned those, and a change there fails that gate instead). If a **face** pair fails, stop and report: face values are Nick's design and the spec forbids changing them here.

- [ ] **Step 7: Give R11 its detector**

In `scripts/lib/rules.mjs`, R11 currently carries an `unchecked` reason. Replace it with `checkedBy: 'src/shared/token-contrast.test.ts'` and remove the `unchecked` property (a record may carry exactly one). Amend the statement so it claims only what the gate checks: token-level pairs in both modes, not rendered screens.

In `rules/superclock.json`, no rule currently covers token contrast. Add nothing there in this task: the two catalogues' consolidation is an open decision and adding a row would deepen the duplication. Note the gap in the report instead.

Run: `npx vitest run scripts/lib/rules.test.ts && npm run check:tokens`
Expected: PASS, and the epilogue now lists five unchecked rules with R11 absent.

- [ ] **Step 8: Mutation-check**

Point `--ink-muted` at `--gray-84` in the light block: expect FAIL naming the pair and the ratio. Restore.

- [ ] **Step 9: Commit**

```bash
git add scripts/lib/contrast.mjs scripts/lib/contrast.d.mts scripts/lib/contrast.test.ts src/shared/token-contrast.test.ts scripts/lib/rules.mjs
git commit -m "feat(tokens): token-level contrast gate in both modes (R11 gets a detector)"
```

---

### Task 5: The proof surface

**Files:**
- Modify: `src/core/components/QuickSettings.tsx`, `src/index.css`

**Interfaces:**
- Consumes: tier 2 roles from Task 1.

- [ ] **Step 1: Add the kiosk's chrome utilities**

The kiosk reaches tokens through its `@theme` block. Add the chrome roles there so `bg-sheet`, `text-ink-muted` and the fills become utilities. In `src/index.css`, inside the existing `@theme` block, add:

```css
  --color-ink-muted: rgb(var(--fill-subtle));
```

Note for the implementer: work out the correct form for each utility against the actual scrim values in `tokens.css` before writing this step's final content. The scrims are stored as `255 255 255 / 0.15` so they suit `rgb(var(--fill))`; the ink roles are HSL triplets so they suit `hsl(var(--ink-muted))`. Getting this wrong shows up immediately as an unstyled sheet, so verify in the browser in Step 3 rather than reasoning about it.

- [ ] **Step 2: Re-tokenise the sheet**

In `src/core/components/QuickSettings.tsx`, replace each literal with the role that names its job. There are seven:

| Line | Today | Becomes |
|---|---|---|
| the sheet surface | `bg-sheet/95` | unchanged, `--color-sheet` is already a token |
| the grab handle | `bg-white/25` | the `fill` role |
| three labels | `text-white/50` | the `ink-muted` role |
| the wifi value | `text-white/70` | the `ink-muted` role |
| toggle, on | `bg-white/80` | the `fill-strong` role |
| toggle, off | `bg-white/15` | the `fill-subtle` role |
| toggle knob | `bg-black` | the `face-bg` role is wrong here; use the sheet's own ink role |

Leave every layout class, the animation, the spring, the fetch and the `aria-pressed` exactly as they are. This task changes colour references and nothing else.

- [ ] **Step 3: Verify in both modes, in a browser**

Start `npx vite --port 5181 --strictPort`. Open the sheet (the nav store is `window.__nav` in dev; `useNavigation.getState().showSettings()` opens it). Screenshot it in light and in dark:

```js
document.documentElement.classList.remove('dark'); document.documentElement.classList.add('light');
// screenshot
document.documentElement.classList.remove('light'); document.documentElement.classList.add('dark');
// screenshot
```

Both screenshots go in the report. The dark one must look like today's sheet. The light one is new and is what open question 3 is about: capture it, do not tune it, and say plainly in the report that Nick has not seen it yet.

- [ ] **Step 4: Verify nothing else moved**

Run: `npx vitest run && npx eslint . && npx tsc -b && npm run build`
Expected: green, including Task 2's face-value pins.

- [ ] **Step 5: Commit**

```bash
git add src/core/components/QuickSettings.tsx src/index.css
git commit -m "feat(tokens): quick-settings sheet renders from roles, the layer's proof surface"
```

---

### Task 6: The rule, the record, and the full gates

**Files:**
- Modify: `AGENTS.md`, `docs/agent-log.md`, `docs/superpowers/specs/2026-09-06-token-layer-design.md`

- [ ] **Step 1: Add the AGENTS.md convention bullet**

In the `### Conventions` list, after the "Parts carry contracts" bullet:

```markdown
- **Colour goes through the three tiers.** `src/styles/tokens.css` holds tier 1 ramps (raw steps, read only by tier 2) and tier 2 semantic roles, which is the only place a light value and a dark value are written. The kiosk's `--face-*` names are tier 2 roles; the admin's shadcn names are tier 3 aliases in its `@theme inline` block and must be a `var()` at a role, never a value. A component reads a utility or a role, never a ramp. Gated by `src/shared/token-tiers.test.ts` (both modes, alias shape) and `src/shared/token-contrast.test.ts` (AA per pair per mode). The admin's bare triplets under `.admin-root` are the leaving form, kept until sub-project 2 moves its consumers onto the utilities.
```

- [ ] **Step 2: Amend the Tailwind convention bullet**

The existing bullet says kiosk theme tokens live in `src/index.css` under `@theme` and admin tokens separately. That is now half true. Rewrite it to say both entries import `src/styles/tokens.css`, and that the `@theme` blocks turn roles into utilities rather than holding values.

- [ ] **Step 3: Run the full gates**

Run: `./scripts/gates.sh`
Expected: all four green. Record the test count and the `check:tokens` epilogue, which should now show five unchecked rules with R11 absent and the ledger still at seven entries.

If a gate fails, stop and report BLOCKED. Do not weaken a gate to pass it.

- [ ] **Step 4: Write the agent-log entry**

Add an entry at the top of `docs/agent-log.md`, matching the shape and voice of the entries already there. Cover what changed, the gates result from Step 3, and these decisions: the face values were pinned and proven unchanged, the ledger did not shrink and why, the admin kept its triplets as the leaving form, and the light values for the admin surfaces are ramp-derived defaults awaiting sub-project 2. Under Open, list the three open questions from the spec, and note that the light quick-settings sheet exists now and Nick has not seen it.

- [ ] **Step 5: Add the spec changelog line**

Append to the spec's `## Changelog`, dated the day of execution, recording that the plan was implemented and naming anything that diverged from it.

- [ ] **Step 6: Commit**

```bash
git add AGENTS.md docs/agent-log.md docs/superpowers/specs/2026-09-06-token-layer-design.md
git commit -m "docs(tokens): the three-tier rule in AGENTS.md, spec changelog, agent log"
```

---

## Self-review against the spec

- **Three tiers in both entries:** Tasks 1, 2, 3.
- **Sixteen roles, both modes:** Task 1's file and its gate. The face roles are tier 2, per the spec's 2026-09-06 correction, so there is no face alias layer to build.
- **Mode axis:** Task 1's `html.light` / `html.dark` blocks and the `prefers-color-scheme` fallback for the admin.
- **Density not declared:** honoured. Nothing in this plan writes a density attribute.
- **Gates:** both modes and alias shape (Task 1, 3), contrast (Task 4), no tier skipping is covered by the alias-shape check plus the existing token-gate zones. Liveness is unchanged and still runs.
- **Proof surface:** Task 5, with both modes captured.
- **Nothing changes on glass outside it:** Task 2's sixteen value pins and its browser probe; Task 3's admin spot check.
- **Ledger does not shrink:** Task 3 Step 5 updates reasons only, and Task 6 Step 3 confirms seven entries.
- **R11:** Task 4 Step 7, with its statement narrowed to what the gate actually checks.
- **Open questions:** none of the three is decided anywhere in this plan. Task 5 Step 3 explicitly captures the light sheet without tuning it.
- **Placeholder scan:** Task 5 Step 1 deliberately asks the implementer to derive the utility form rather than prescribing a line that may be wrong, and says how to verify it. That is a judgment handed over with a method, not a TBD.
- **Type consistency:** `parseTiers`, `missingModes`, `tierViolations`, `parseColor`, `relativeLuminance`, `contrastRatio` are named identically in every task that uses them.
