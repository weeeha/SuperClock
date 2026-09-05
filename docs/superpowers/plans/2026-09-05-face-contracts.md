# Face and Widget Contracts Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Every face and kiosk widget carries a co-located `.meta.json` usage contract whose claims are gated against the source, hand-and-tick faces draw their numbers from that file, and a parity test diffs the LVGL C constants against the same file.

**Architecture:** A zod schema in `src/shared/part-meta.ts` validates the files; a real-tree vitest gate checks every claim (tokens read, option keys, parity path, geometry state) the way `registry-contract.test.ts` checks the registries. Pure `.mjs` modules under `scripts/lib/` (fs-free, fixture-tested, with `.d.mts` types so `src/` can import them under strict tsconfig) parse the C file and emit the index; thin runners own globbing. Shrink-only lists (`SPEC_PENDING`, `PARITY_DRIFT_LEDGER`) keep day one green while naming every gap.

**Tech Stack:** TypeScript (strict, `verbatimModuleSyntax`, `resolveJsonModule` on), zod 4, vitest 4, Node 22 (`fs.globSync`), React 19, Vite 8. No new dependencies.

**Spec:** `docs/superpowers/specs/2026-09-05-face-contracts-design.md`

## Global Constraints

- Work lands as local changes; no pushes, no pull requests (Nick, 2026-09-05). Commit steps below are local commits with explicit paths; if Nick has not asked for commits, skip them and record the state in `docs/agent-log.md` instead.
- TDD: every test is watched red before its implementation; `./scripts/gates.sh` (lint, check:tokens, test, build) green before "done"; each new gate mutation-checked with files restored.
- No palette or geometry change to turn a gate green. The Analog React-versus-C drift is ledgered, never fixed here.
- The TSX keeps reading its own `--face-*` tokens (the token gate and the liveness gate see the TSX, not JSON); it takes numbers and literal or `config:` colours from `spec`.
- Meta files carry judgments, never restated props. No string in a meta may begin with `TODO`.
- Prose in docs and metas: no em dashes, no exclamation marks, plain words.
- `verbatimModuleSyntax`: type-only imports use `import type`. `erasableSyntaxOnly`: no enums.
- Node scripts resolve paths with `fileURLToPath`, never `URL.pathname` (the checkout path contains spaces). Quote every shell path.
- Kiosk performance: a meta is parsed once at module scope; nothing new ticks.

## File map

| File | Responsibility |
|---|---|
| `src/shared/part-meta.ts` (new) | zod schemas for face and widget metas, `SPEC_PENDING`, `resolveSpecColor`, `specOf` |
| `src/shared/part-meta.test.ts` (new) | fixture tests for every rejection reason and helper |
| `src/shared/part-contracts.test.ts` (new) | real-tree gate: one meta per part, claims against source, geometry state |
| `scripts/lib/token-rules.d.mts` (new) | types for the two token-rules exports the gate imports |
| `src/apps/clock/*.meta.json` (13 new) | the face contracts |
| `src/core/widgets/RoundList.meta.json`, `src/apps/agents/StateRing.meta.json` (new) | the widget contracts |
| `src/apps/clock/AnalogClock.tsx`, `MinimalismoClock.tsx` (modify) | draw numbers from `spec` |
| `scripts/lib/lvgl-parity.mjs` + `.d.mts` + `.test.ts` (new) | C initializer and colour parser, spec comparison, drift ledger |
| `src/shared/lvgl-parity.test.ts` (new) | real-tree parity gate |
| `scripts/lib/parts-index.mjs` + `.d.mts` + `.test.ts` (new) | `WIDGET_META_PATHS`, row builder, TOON emitter |
| `scripts/build-index.mjs` (new), `index/parts.toon` (new) | runner and the committed index |
| `src/shared/parts-index.test.ts` (new) | drift gate |
| `scripts/lib/scaffold-templates.mjs`, `scripts/new-face.mjs`, `scripts/lib/scaffold-templates.test.ts` (modify) | meta stub for new faces |
| `scripts/lib/rules.mjs` (modify) | R10 gains a detector; R16 and R17 added |
| `package.json` (modify) | `build:index` script |
| `AGENTS.md`, `docs/agent-log.md`, the spec's changelog (modify) | the rule, the handoff, the record |

---

### Task 1: Part meta schema and helpers

**Files:**
- Create: `src/shared/part-meta.ts`
- Test: `src/shared/part-meta.test.ts`

**Interfaces:**
- Produces: `faceSpecSchema`, `faceMetaSchema`, `widgetMetaSchema`, `partMetaSchema` (zod), types `FaceSpec`, `FaceMeta`, `WidgetMeta`, `PartMeta`, `SPEC_PENDING: readonly string[]`, `resolveSpecColor(value: string, options: Record<string, unknown>): string`, `specOf(meta: unknown, file: string): FaceSpec`.

- [ ] **Step 1: Write the failing tests**

```ts
// src/shared/part-meta.test.ts
// Fixture tests for the part contract schema. Every rejection reason has a
// case, so a meta that fails the real-tree gate fails for a reason that was
// decided here, not for an accident of zod's defaults.
import { describe, it, expect } from 'vitest';
import {
  faceMetaSchema,
  widgetMetaSchema,
  partMetaSchema,
  resolveSpecColor,
  specOf,
  SPEC_PENDING,
} from './part-meta';

const SPEC = {
  space: 1000,
  radius: 500,
  face: { background: '--face-bg', ink: '--face-ink' },
  hands: {
    hour: { tip: 280, width: 28 },
    minute: { tip: 380, width: 20 },
    second: { tip: 350, tail: 80, width: 6, color: '#FFD700' },
  },
  ticks: null,
  dot: null,
};

const FACE = {
  kind: 'face',
  id: 'minimalismo',
  purpose: 'A bare white dial with two black hands and a gold sweeping second hand, nothing else.',
  accent: { where: 'the second hand', color: '#FFD700' },
  night: { recipe: 'Tokens flip bg and ink; the gold second hand stays gold.', tokens: ['--face-bg'] },
  options: [],
  antiPatterns: [{ rule: 'Do not add ticks', why: 'the face is defined by their absence' }],
  parity: { lvgl: null },
  spec: SPEC,
};

const WIDGET = {
  kind: 'widget',
  id: 'round-list',
  purpose: 'A centre-column vertical list for the round viewport, with an edge fade and a required empty state.',
  tokens: [],
  states: [{ state: 'empty', recipe: 'The empty node is rendered in place of the rows; it is a required prop.' }],
  antiPatterns: [{ rule: 'Do not render without an empty state', why: 'an empty list must say why it is empty' }],
};

describe('faceMetaSchema', () => {
  it('accepts a complete face meta', () => {
    expect(faceMetaSchema.safeParse(FACE).success).toBe(true);
  });

  it('rejects any string that begins with TODO, naming the reason', () => {
    const r = faceMetaSchema.safeParse({ ...FACE, purpose: 'TODO: write me and make it long enough' });
    expect(r.success).toBe(false);
    expect(r.error?.issues.some((i) => i.message.includes('TODO'))).toBe(true);
  });

  it('rejects spec and specless together', () => {
    const r = faceMetaSchema.safeParse({ ...FACE, specless: 'a lattice, no hands or ticks' });
    expect(r.success).toBe(false);
    expect(r.error?.issues.some((i) => i.message.includes('exclusive'))).toBe(true);
  });

  it('accepts a face with neither spec nor specless (the SPEC_PENDING case is decided by the gate)', () => {
    const { spec: _spec, ...pending } = FACE;
    void _spec;
    expect(faceMetaSchema.safeParse(pending).success).toBe(true);
  });

  it('rejects an LVGL parity claim without spec', () => {
    const { spec: _spec, ...noSpec } = FACE;
    void _spec;
    const r = faceMetaSchema.safeParse({ ...noSpec, parity: { lvgl: 'slow-native/src/clock_face.c' } });
    expect(r.success).toBe(false);
    expect(r.error?.issues.some((i) => i.message.includes('parity'))).toBe(true);
  });

  it('rejects a config: accent that names no option', () => {
    const r = faceMetaSchema.safeParse({ ...FACE, accent: { where: 'seconds', color: 'config:accent' } });
    expect(r.success).toBe(false);
    expect(r.error?.issues.some((i) => i.message.includes('config:accent'))).toBe(true);
  });

  it('accepts accent null for a face with no saturated quantity', () => {
    expect(faceMetaSchema.safeParse({ ...FACE, accent: null }).success).toBe(true);
  });

  it('rejects a colour that is neither a token, a #rrggbb literal, nor config:<key>', () => {
    const r = faceMetaSchema.safeParse({ ...FACE, accent: { where: 'seconds', color: 'gold' } });
    expect(r.success).toBe(false);
  });

  it('rejects a night token outside the --face-* family', () => {
    const r = faceMetaSchema.safeParse({ ...FACE, night: { ...FACE.night, tokens: ['--color-accent'] } });
    expect(r.success).toBe(false);
  });

  it('rejects an anti-pattern without a why', () => {
    const r = faceMetaSchema.safeParse({ ...FACE, antiPatterns: [{ rule: 'Do not add ticks', why: 'because' }] });
    expect(r.success).toBe(false);
  });

  it('rejects unknown fields (the file restates no props)', () => {
    const r = faceMetaSchema.safeParse({ ...FACE, category: 'classic' });
    expect(r.success).toBe(false);
  });

  it('rejects a tick whose outer edge is not beyond its inner edge', () => {
    const bad = { ...SPEC, ticks: { hour: { inner: 480, outer: 420, width: 12 }, minute: { inner: 435, outer: 460, width: 4 } } };
    expect(faceMetaSchema.safeParse({ ...FACE, spec: bad }).success).toBe(false);
  });
});

describe('widgetMetaSchema and partMetaSchema', () => {
  it('accepts a widget meta and routes it through partMetaSchema', () => {
    expect(widgetMetaSchema.safeParse(WIDGET).success).toBe(true);
    expect(partMetaSchema.safeParse(WIDGET).success).toBe(true);
    expect(partMetaSchema.safeParse(FACE).success).toBe(true);
  });

  it('rejects a widget with no states', () => {
    expect(widgetMetaSchema.safeParse({ ...WIDGET, states: [] }).success).toBe(false);
  });
});

describe('resolveSpecColor', () => {
  it('maps config:<key> to the option value, a token to var(), and passes literals through', () => {
    expect(resolveSpecColor('config:accent', { accent: '#FFD700' })).toBe('#FFD700');
    expect(resolveSpecColor('--face-ink', {})).toBe('var(--face-ink)');
    expect(resolveSpecColor('#000000', {})).toBe('#000000');
  });

  it('throws on a config: key the options do not carry', () => {
    expect(() => resolveSpecColor('config:missing', { accent: '#FFD700' })).toThrow('config:missing');
  });
});

describe('specOf', () => {
  it('returns the spec of a valid face meta', () => {
    expect(specOf(FACE, 'fixture').hands.hour.tip).toBe(280);
  });

  it('throws, naming the file, when the meta has no spec', () => {
    const { spec: _spec, ...noSpec } = FACE;
    void _spec;
    expect(() => specOf(noSpec, 'X.meta.json')).toThrow('X.meta.json');
  });
});

describe('SPEC_PENDING', () => {
  it('holds kebab face ids only', () => {
    for (const id of SPEC_PENDING) expect(id).toMatch(/^[a-z][a-z0-9-]*$/);
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run src/shared/part-meta.test.ts`
Expected: FAIL with `Cannot find module './part-meta'`.

- [ ] **Step 3: Write the schema module**

```ts
// src/shared/part-meta.ts
// The usage contract beside every face and kiosk widget: the judgments a
// designer applies when placing or changing the part, written down so an
// agent does not infer them, plus, for hand-and-tick faces, the numbers the
// face is drawn from. Spec: docs/superpowers/specs/2026-09-05-face-contracts-design.md
//
// What belongs here is DECISIONS, not restated props: TypeScript already
// states the props. Every anti-pattern carries its why, because a bare
// "don't" reads as arbitrary and gets rationalised away.
import { z } from 'zod';

const NO_TODO_MESSAGE = 'begins with TODO: the scaffold stub has not been filled in';
const prose = (min: number) =>
  z
    .string()
    .min(min)
    .refine((s) => !s.startsWith('TODO'), { message: NO_TODO_MESSAGE });

/** A --token name, a #rrggbb literal, or config:<optionKey>. */
const colorRef = z
  .string()
  .regex(/^(--[\w-]+|#[0-9a-fA-F]{6}|config:[A-Za-z_$][\w$]*)$/, 'a --token, #rrggbb, or config:<optionKey>');

const faceToken = z.string().regex(/^--face-[\w-]+$/, 'night tokens are --face-* names');
const int = z.number().int().nonnegative();

const handSchema = z
  .object({
    tip: z.number().int().positive(),
    tail: int.optional(),
    width: z.number().int().positive(),
    color: colorRef.optional(),
  })
  .strict();

const tickSchema = z
  .object({ inner: int, outer: int, width: z.number().int().positive() })
  .strict()
  .refine((t) => t.outer > t.inner, { message: 'outer must be beyond inner' });

/** The numbers a hand-and-tick face is drawn from, in the 1000-unit render
 *  space every face and the LVGL geom_t struct already share. Lengths are
 *  from the centre, widths are stroke widths, dot values are radii. */
export const faceSpecSchema = z
  .object({
    space: z.literal(1000),
    radius: z.number().int().positive(),
    face: z.object({ background: colorRef, ink: colorRef }).strict(),
    hands: z.object({ hour: handSchema, minute: handSchema, second: handSchema.optional() }).strict(),
    ticks: z.object({ hour: tickSchema, minute: tickSchema }).strict().nullable(),
    dot: z
      .object({
        outer: z.number().int().positive(),
        inner: int,
        outerColor: colorRef.optional(),
        innerColor: colorRef.optional(),
      })
      .strict()
      .nullable(),
  })
  .strict();

const antiPatternSchema = z.object({ rule: prose(10), why: prose(20) }).strict();
const idSchema = z.string().regex(/^[a-z][a-z0-9-]*$/, 'kebab id');

export const faceMetaSchema = z
  .object({
    kind: z.literal('face'),
    id: idSchema,
    purpose: prose(40),
    /** null when the face has no saturated quantity; one object otherwise.
     *  One object is the one-accent rule written as data. */
    accent: z.object({ where: prose(3), color: colorRef }).strict().nullable(),
    night: z.object({ recipe: prose(20), tokens: z.array(faceToken) }).strict(),
    options: z.array(z.object({ key: z.string().min(1), intent: prose(20) }).strict()),
    antiPatterns: z.array(antiPatternSchema).min(1),
    parity: z.object({ lvgl: z.string().min(1).nullable() }).strict(),
    spec: faceSpecSchema.optional(),
    specless: prose(20).optional(),
  })
  .strict()
  .superRefine((m, ctx) => {
    if (m.spec && m.specless) {
      ctx.addIssue({ code: 'custom', message: 'spec and specless are exclusive' });
    }
    if (m.parity.lvgl && !m.spec) {
      ctx.addIssue({ code: 'custom', message: 'a face claiming LVGL parity must carry spec' });
    }
    if (m.accent?.color.startsWith('config:')) {
      const key = m.accent.color.slice('config:'.length);
      if (!m.options.some((o) => o.key === key)) {
        ctx.addIssue({ code: 'custom', message: `accent config:${key} names no option` });
      }
    }
  });

export const widgetMetaSchema = z
  .object({
    kind: z.literal('widget'),
    id: idSchema,
    purpose: prose(40),
    tokens: z.array(z.string().regex(/^--[\w-]+$/)),
    states: z.array(z.object({ state: z.string().min(1), recipe: prose(20) }).strict()).min(1),
    antiPatterns: z.array(antiPatternSchema).min(1),
    insteadUse: z.array(idSchema).optional(),
  })
  .strict();

export const partMetaSchema = z.union([faceMetaSchema, widgetMetaSchema]);

export type FaceSpec = z.infer<typeof faceSpecSchema>;
export type FaceMeta = z.infer<typeof faceMetaSchema>;
export type WidgetMeta = z.infer<typeof widgetMetaSchema>;
export type PartMeta = z.infer<typeof partMetaSchema>;

// Faces whose numbers still live in the TSX. May only SHRINK: move the
// numbers into the meta's `spec`, make the TSX read them, delete the line.
// A listed face that already carries spec or specless fails the gate as
// stale. A new face never enters this list; it is born with spec or specless.
export const SPEC_PENDING: readonly string[] = [
  'analog',
  'minimalismo',
  'productivity',
  'square',
  'floral',
  'complications-light',
  'complications-dark',
  'world',
];

/** Resolve a spec colour for rendering: config:<key> reads the face option,
 *  a --token becomes var(--token), a literal passes through. */
export function resolveSpecColor(value: string, options: Record<string, unknown>): string {
  if (value.startsWith('config:')) {
    const key = value.slice('config:'.length);
    const v = options[key];
    if (typeof v !== 'string') throw new Error(`${value}: face options carry no string "${key}"`);
    return v;
  }
  if (value.startsWith('--')) return `var(${value})`;
  return value;
}

/** Parse a meta at module scope and return its spec, or throw naming the
 *  file so a face never renders from a contract it does not have. */
export function specOf(meta: unknown, file: string): FaceSpec {
  const parsed = faceMetaSchema.parse(meta);
  if (!parsed.spec) throw new Error(`${file} carries no spec; this face draws from its contract`);
  return parsed.spec;
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run src/shared/part-meta.test.ts`
Expected: PASS, 19 tests.

- [ ] **Step 5: Lint and typecheck the new module**

Run: `npx eslint src/shared/part-meta.ts src/shared/part-meta.test.ts && npx tsc -b`
Expected: no output from eslint, tsc exits 0.

- [ ] **Step 6: Commit (local only)**

```bash
git add src/shared/part-meta.ts src/shared/part-meta.test.ts
git commit -m "feat(contracts): part meta schema, SPEC_PENDING, colour and spec helpers"
```

---

### Task 2: The contract gate and the fifteen contract files

**Files:**
- Create: `scripts/lib/token-rules.d.mts`
- Create: `src/shared/part-contracts.test.ts`
- Create: `src/apps/clock/{MinimalismoClock,AnalogClock,ProductivityClock,SquareClock,FloralClock,ComplicationsLight,ComplicationsDark,WorldClock,FlipClock,DepletionClock,ApertureClock,DaylightClock,StrokesClock}.meta.json`
- Create: `src/core/widgets/RoundList.meta.json`, `src/apps/agents/StateRing.meta.json`
- Modify: `scripts/lib/rules.mjs` (add R16)

**Interfaces:**
- Consumes: Task 1's `partMetaSchema`, `SPEC_PENDING`; `FACE_COMPONENTS` from `src/apps/clock/face-components.ts`; `FACES` from `src/shared/face-registry.ts`; `SCHEMAS` from `src/shared/schema-registry.ts`; `FACE_TOKEN_EXEMPT` from `scripts/lib/token-rules.mjs`.
- Produces: the meta files every later task reads; the convention that a face's meta is `src/apps/clock/<ComponentFunctionName>.meta.json` (`FACE_COMPONENTS[id].name` is the component function name, e.g. `AnalogClock`); `WIDGET_META_PATHS` is defined here temporarily and moves to `scripts/lib/parts-index.mjs` in Task 6.

- [ ] **Step 1: Write the type declaration the gate needs**

```ts
// scripts/lib/token-rules.d.mts
// Only the two exports src/ imports; the .mjs stays the source of truth.
export declare const FACE_TOKEN_EXEMPT: string[];
export declare function parseFaceComponentFiles(source: string): string[];
```

- [ ] **Step 2: Write the failing gate**

```ts
// src/shared/part-contracts.test.ts
// The contract gate: every face in FACE_COMPONENTS and every widget carries
// a .meta.json beside its component, the file validates, and every claim in
// it is true of the source. Same shape as registry-contract.test.ts: the
// judgments are prose, the facts around them cannot drift.
import { describe, it, expect } from 'vitest';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { FACE_COMPONENTS } from '../apps/clock/face-components';
import { FACES } from './face-registry';
import { SCHEMAS } from './schema-registry';
import { faceMetaSchema, widgetMetaSchema, SPEC_PENDING } from './part-meta';
import type { FaceMeta, WidgetMeta } from './part-meta';
import { FACE_TOKEN_EXEMPT } from '../../scripts/lib/token-rules.mjs';

// Moves to scripts/lib/parts-index.mjs when the index emitter lands.
const WIDGET_META_PATHS = ['src/core/widgets/RoundList.meta.json', 'src/apps/agents/StateRing.meta.json'];

interface FacePart {
  id: string;
  name: string;
  tsx: string;
  metaPath: string;
}

const faceParts: FacePart[] = Object.entries(FACE_COMPONENTS).map(([id, component]) => {
  const name = component.name;
  return { id, name, tsx: `src/apps/clock/${name}.tsx`, metaPath: `src/apps/clock/${name}.meta.json` };
});

function readsToken(source: string, token: string): boolean {
  return source.includes(`(${token})`);
}

function loadFace(part: FacePart): FaceMeta {
  return faceMetaSchema.parse(JSON.parse(readFileSync(part.metaPath, 'utf8')));
}

function schemaKeys(id: string): string[] {
  const schemaId = FACES.find((f) => f.id === id)?.configSchemaId;
  if (!schemaId) return [];
  return Object.keys(SCHEMAS[schemaId].schema.shape).sort();
}

describe('face contracts', () => {
  it('maps every face to an existing component file (the meta path derives from it)', () => {
    for (const part of faceParts) {
      expect(existsSync(part.tsx), `${part.id}: ${part.tsx} does not exist; the meta path derivation is broken`).toBe(true);
    }
  });

  it('every face has a meta beside its component that validates, with kind face and its own id', () => {
    for (const part of faceParts) {
      expect(existsSync(part.metaPath), `${part.id}: missing ${part.metaPath}`).toBe(true);
      const meta = loadFace(part);
      expect(meta.kind).toBe('face');
      expect(meta.id, `${part.metaPath} names a different face`).toBe(part.id);
    }
  });

  it('no meta file under src/apps/clock belongs to a face that does not exist', () => {
    const known = new Set(faceParts.map((p) => p.metaPath));
    for (const file of readdirSync('src/apps/clock')) {
      if (!file.endsWith('.meta.json')) continue;
      expect(known.has(`src/apps/clock/${file}`), `orphan contract src/apps/clock/${file}`).toBe(true);
    }
  });

  it('every night token a face claims is read by its TSX, and a non-exempt face claims at least one', () => {
    for (const part of faceParts) {
      const meta = loadFace(part);
      const source = readFileSync(part.tsx, 'utf8');
      for (const token of meta.night.tokens) {
        expect(readsToken(source, token), `${part.id} claims ${token} but ${part.tsx} never reads (${token})`).toBe(true);
      }
      const exempt = FACE_TOKEN_EXEMPT.includes(`${part.name}.tsx`);
      if (!exempt) {
        expect(meta.night.tokens.length, `${part.id} is not night-exempt and claims no --face-* token`).toBeGreaterThan(0);
      }
    }
  });

  it('every option in a meta is a key of the face schema, and every schema key has an intent', () => {
    for (const part of faceParts) {
      const meta = loadFace(part);
      const declared = meta.options.map((o) => o.key).sort();
      expect(declared, `${part.id}: options differ from face schema keys`).toEqual(schemaKeys(part.id));
    }
  });

  it('a parity path, when claimed, exists', () => {
    for (const part of faceParts) {
      const meta = loadFace(part);
      if (meta.parity.lvgl) {
        expect(existsSync(meta.parity.lvgl), `${part.id}: parity file ${meta.parity.lvgl} missing`).toBe(true);
      }
    }
  });

  it('geometry state: spec or specless, unless the face is on SPEC_PENDING, which allows neither', () => {
    for (const part of faceParts) {
      const meta = loadFace(part);
      const pending = SPEC_PENDING.includes(part.id);
      const has = Boolean(meta.spec) || Boolean(meta.specless);
      if (pending) {
        expect(has, `${part.id} is on SPEC_PENDING but carries spec or specless: delete its SPEC_PENDING line`).toBe(false);
      } else {
        expect(has, `${part.id}: add spec (numbers) or specless (reason), or list it on SPEC_PENDING`).toBe(true);
      }
    }
  });

  it('SPEC_PENDING names faces that exist', () => {
    const ids = new Set(faceParts.map((p) => p.id));
    for (const id of SPEC_PENDING) expect(ids.has(id), `SPEC_PENDING names unknown face ${id}`).toBe(true);
  });

  it('a face carrying spec imports its meta (its numbers are read structurally)', () => {
    for (const part of faceParts) {
      const meta = loadFace(part);
      if (!meta.spec) continue;
      const source = readFileSync(part.tsx, 'utf8');
      expect(source.includes(`from './${part.name}.meta.json'`), `${part.tsx} carries spec but does not import ${part.name}.meta.json`).toBe(true);
      for (const token of [meta.spec.face.background, meta.spec.face.ink]) {
        if (token.startsWith('--')) {
          expect(readsToken(source, token), `${part.id}: spec names ${token} but the TSX never reads it`).toBe(true);
        }
      }
    }
  });
});

describe('widget contracts', () => {
  const widgets = WIDGET_META_PATHS.map((metaPath) => ({ metaPath, tsx: metaPath.replace(/\.meta\.json$/, '.tsx') }));

  function loadWidget(metaPath: string): WidgetMeta {
    return widgetMetaSchema.parse(JSON.parse(readFileSync(metaPath, 'utf8')));
  }

  it('every widget has a meta that validates beside an existing component', () => {
    for (const w of widgets) {
      expect(existsSync(w.tsx), `${w.tsx} missing`).toBe(true);
      expect(existsSync(w.metaPath), `${w.metaPath} missing`).toBe(true);
      expect(loadWidget(w.metaPath).kind).toBe('widget');
    }
  });

  it('every token a widget claims is read by its TSX', () => {
    for (const w of widgets) {
      const meta = loadWidget(w.metaPath);
      const source = readFileSync(w.tsx, 'utf8');
      for (const token of meta.tokens) {
        expect(readsToken(source, token), `${meta.id} claims ${token} but ${w.tsx} never reads it`).toBe(true);
      }
    }
  });

  it('insteadUse names existing parts, and ids are unique across faces and widgets', () => {
    const ids = [...faceParts.map((p) => p.id), ...widgets.map((w) => loadWidget(w.metaPath).id)];
    expect(new Set(ids).size, `duplicate part ids: ${ids.join(', ')}`).toBe(ids.length);
    for (const w of widgets) {
      for (const ref of loadWidget(w.metaPath).insteadUse ?? []) {
        expect(ids, `${w.metaPath}: insteadUse names unknown part ${ref}`).toContain(ref);
      }
    }
  });
});
```

- [ ] **Step 3: Run the gate to verify it fails for the missing files**

Run: `npx vitest run src/shared/part-contracts.test.ts`
Expected: FAIL; the second face test names `src/apps/clock/MinimalismoClock.meta.json` as missing, the widget test names `src/core/widgets/RoundList.meta.json`.

- [ ] **Step 4: Write the thirteen face contracts**

Every string below is a proposal drafted from the specs and the code comments; Nick reviews them (spec, open questions). Keep the JSON exactly shaped like this; the schema is strict.

`src/apps/clock/MinimalismoClock.meta.json`
```json
{
  "kind": "face",
  "id": "minimalismo",
  "purpose": "A bare dial with two ink hands and a gold sweeping second hand, nothing else. It refuses ticks, numerals and a centre dot: it was kept on the Slow prototype because the ticks failed to render and the bare face was better.",
  "accent": { "where": "the second hand", "color": "#FFD700" },
  "night": {
    "recipe": "The bg and ink tokens flip with the palette; the gold second hand stays gold in both.",
    "tokens": ["--face-bg", "--face-ink"]
  },
  "options": [],
  "antiPatterns": [
    { "rule": "Do not add ticks, numerals or a centre pip", "why": "the face is defined by their absence; the moment one returns it is Analog" },
    { "rule": "Never rotate the hands with CSS transforms or transitions", "why": "handPoints geometry is what makes a backsweep and a float32 jump impossible by construction" }
  ],
  "parity": { "lvgl": null }
}
```

`src/apps/clock/AnalogClock.meta.json`
```json
{
  "kind": "face",
  "id": "analog",
  "purpose": "The Swiss railway reference: sixty ticks, heavy white hands on a black dial, an accent second hand and pip. It is the face the LVGL client mirrors, so its numbers are the fleet's shared vocabulary.",
  "accent": { "where": "the second hand and the outer centre pip", "color": "config:accent" },
  "night": {
    "recipe": "Ignores night: a legacy exempt face, black dial in both palettes. Retrofitting means reading --face-bg and --face-ink and deleting its FACE_TOKEN_EXEMPT line.",
    "tokens": []
  },
  "options": [
    { "key": "accent", "intent": "One saturated colour that paints the second hand and the pip together; never two colours on one dial." },
    { "key": "numeralStyle", "intent": "none keeps the railway look; arabic or roman only when the dial is read at a glance from across a room." },
    { "key": "showSeconds", "intent": "Off removes the only moving accent; use it for a still bedside face." }
  ],
  "antiPatterns": [
    { "rule": "Do not thin the hands to make room for numerals", "why": "the 28 and 20 widths are the railway signature and the LVGL twin draws the same" },
    { "rule": "Do not change a number here without the C twin", "why": "the parity test diffs clock_face.c against this file; a one-sided change is a red gate, not a fix" }
  ],
  "parity": { "lvgl": "slow-native/src/clock_face.c" }
}
```
Note: Analog stays on `SPEC_PENDING` until Task 3 adds its `spec` block; the parity claim above needs `spec`, so until Task 3 this file must carry `"parity": { "lvgl": null }`. Write `null` now; Task 3 sets the path together with the spec.

`src/apps/clock/ProductivityClock.meta.json`
```json
{
  "kind": "face",
  "id": "productivity",
  "purpose": "Coloured rim segments block the day into spans around a plain dial. The segments are the message; the hands are the reference for reading them.",
  "accent": { "where": "the second hand and the highlighted segment", "color": "config:accent" },
  "night": { "recipe": "Ignores night: a legacy exempt face with its own fixed palette until it is retrofitted to read --face-bg and --face-ink.", "tokens": [] },
  "options": [
    { "key": "accent", "intent": "The colour of the second hand and the live segment; one colour, so the rim reads as a clock and not a chart." },
    { "key": "showSeconds", "intent": "Off for a still face; the segments still show the span." }
  ],
  "antiPatterns": [
    { "rule": "Do not add a second saturated colour to the rim", "why": "one accent per face; a second colour turns the segments into a chart" }
  ],
  "parity": { "lvgl": null }
}
```

`src/apps/clock/SquareClock.meta.json`
```json
{
  "kind": "face",
  "id": "square",
  "purpose": "A rounded square dial with numerals at the four cardinals and tick marks, designed for the square device's rectangle. Its corners are load-bearing, which no round face can say.",
  "accent": { "where": "the sub-dial", "color": "config:accent" },
  "night": { "recipe": "Ignores night: a legacy exempt face with a fixed palette until it is retrofitted.", "tokens": [] },
  "options": [
    { "key": "accent", "intent": "The sub-dial colour; keep it the only saturated colour on the face." }
  ],
  "antiPatterns": [
    { "rule": "Do not crop it into the round viewport", "why": "the corners hold the cardinals; on a round device pick another face" }
  ],
  "parity": { "lvgl": null }
}
```

`src/apps/clock/FloralClock.meta.json`
```json
{
  "kind": "face",
  "id": "floral",
  "purpose": "Hands over a floral artwork. The art is the face; the hands exist to stay legible over it, not to decorate it.",
  "accent": { "where": "the hands", "color": "config:accent" },
  "night": { "recipe": "Ignores night: a legacy exempt face; the artwork has no night variant until one is drawn.", "tokens": [] },
  "options": [
    { "key": "accent", "intent": "The hand colour; pick for contrast against the artwork, never to match it." }
  ],
  "antiPatterns": [
    { "rule": "Do not add ticks or numerals over the artwork", "why": "the art carries the composition and marks fight it" }
  ],
  "parity": { "lvgl": null }
}
```

`src/apps/clock/ComplicationsLight.meta.json`
```json
{
  "kind": "face",
  "id": "complications-light",
  "purpose": "A light dial laid out around sub-dial positions for complications. It draws nothing from the complication registry yet; the positions are geometry, not a promise.",
  "accent": { "where": "the sub-dial accents", "color": "config:accent" },
  "night": {
    "recipe": "The dial background and the ticks flip with the palette; the hands and sub-dials keep their own colours.",
    "tokens": ["--face-bg", "--face-tick"]
  },
  "options": [
    { "key": "accent", "intent": "One colour for every sub-dial accent; the sub-dials are siblings, not a hierarchy." }
  ],
  "antiPatterns": [
    { "rule": "Do not present the sub-dial positions as configurable complication slots", "why": "the face reads no slot today; D2 says wire complications, never fake them" }
  ],
  "parity": { "lvgl": null }
}
```

`src/apps/clock/ComplicationsDark.meta.json`
```json
{
  "kind": "face",
  "id": "complications-dark",
  "purpose": "The dark sibling of Complications Light: the same layout on a fixed dark dial. It is the only face that declares slots in the registry, and it hardcodes what it draws in them rather than reading them.",
  "accent": { "where": "the sub-dial accents", "color": "config:accent" },
  "night": { "recipe": "Ignores night: a legacy exempt face that is dark in both palettes until it reads the tokens.", "tokens": [] },
  "options": [
    { "key": "accent", "intent": "One colour for every sub-dial accent; the sub-dials are siblings, not a hierarchy." }
  ],
  "antiPatterns": [
    { "rule": "Do not let the admin assign complications to its four slots as if they rendered", "why": "the slots are declared but the face draws hardcoded content; D2 says wire, never fake" }
  ],
  "parity": { "lvgl": null }
}
```

`src/apps/clock/WorldClock.meta.json`
```json
{
  "kind": "face",
  "id": "world",
  "purpose": "A primary dial for one timezone with secondary dials for others. The primary is the answer; the rest are context and must read as smaller.",
  "accent": { "where": "the primary dial highlight", "color": "config:accent" },
  "night": { "recipe": "Ignores night: a legacy exempt face with a fixed palette until it is retrofitted.", "tokens": [] },
  "options": [
    { "key": "accent", "intent": "Highlights the primary dial only; the secondary dials stay unaccented so the eye lands on one." },
    { "key": "primaryTimezone", "intent": "An IANA name for the dial the owner reads first; local follows the device clock." }
  ],
  "antiPatterns": [
    { "rule": "Do not construct an Intl.DateTimeFormat per render", "why": "one formatter per zone, built once; construction costs milliseconds on a Pi and this used to run five times a second" }
  ],
  "parity": { "lvgl": null }
}
```

`src/apps/clock/FlipClock.meta.json`
```json
{
  "kind": "face",
  "id": "flip",
  "purpose": "Split-flap digits that flip when they change. The mechanism is the face, so the flip is content, not chrome.",
  "accent": { "where": "the digits", "color": "config:accent" },
  "night": { "recipe": "Ignores night: a legacy exempt face; the flaps keep their fixed colours until retrofitted.", "tokens": [] },
  "options": [
    { "key": "accent", "intent": "The digit colour, the only colour on the face." },
    { "key": "hour24", "intent": "On for 24-hour digits; off adds an AM/PM tag and drops the leading zero." }
  ],
  "antiPatterns": [
    { "rule": "Do not animate anything but the digit that changed", "why": "the flip is the only sanctioned motion; ambient motion elsewhere makes it noise" }
  ],
  "parity": { "lvgl": null },
  "specless": "Digits on flaps, no hands or ticks; the hand vocabulary does not describe it."
}
```

`src/apps/clock/DepletionClock.meta.json`
```json
{
  "kind": "face",
  "id": "depletion",
  "purpose": "A 24-hour dial, midnight at top, where the accent wedge is the time left in the day. It drains to nothing at midnight and refills in one frame. No hands: a hairline datum at 12 and a heavy boundary at now.",
  "accent": { "where": "the remaining-time wedge", "color": "--color-accent" },
  "night": {
    "recipe": "The spent area, ticks and ink flip with the palette; the wedge stays the accent.",
    "tokens": ["--face-bg", "--face-ink", "--face-ink-muted", "--face-spent", "--face-tick"]
  },
  "options": [
    { "key": "cycle", "intent": "calendar-day drains to midnight; awake drains to the configured bedtime instead." },
    { "key": "ticks", "intent": "hours for reading the time, quarters for a calmer disc, none for a bare gauge." },
    { "key": "readout", "intent": "remaining prints the hours-and-minutes-left line inside the spent area; none for a pure disc." }
  ],
  "antiPatterns": [
    { "rule": "Do not animate the midnight refill", "why": "it refills in a single frame by design; an animation draws attention to the one moment nobody watches" }
  ],
  "parity": { "lvgl": null },
  "specless": "A wedge and a datum, no hands or ticks in the hand vocabulary."
}
```

`src/apps/clock/ApertureClock.meta.json`
```json
{
  "kind": "face",
  "id": "aperture",
  "purpose": "A plate covers the dial; the hour and minute show through two windows and step, nothing sweeps. The only motion and the only accent is the seconds bar along the bottom of the minute window.",
  "accent": { "where": "the seconds bar", "color": "--color-accent" },
  "night": {
    "recipe": "The plate and the ink flip with the palette; the seconds bar stays the accent.",
    "tokens": ["--face-bg", "--face-ink", "--face-ink-muted", "--face-plate"]
  },
  "options": [
    { "key": "format", "intent": "12h adds a small AM/PM tag beside the hour window; 24h keeps the windows bare." },
    { "key": "showDate", "intent": "A date line under the minute window; off for a face that says only the time." },
    { "key": "secondsBar", "intent": "Off removes the only motion and the only accent, for a fully still face." }
  ],
  "antiPatterns": [
    { "rule": "Do not make the digits sweep or slide", "why": "stepping is the Pallweber signature; motion belongs to the seconds bar alone" }
  ],
  "parity": { "lvgl": null },
  "specless": "Windows in a plate, no hands or ticks."
}
```

`src/apps/clock/DaylightClock.meta.json`
```json
{
  "kind": "face",
  "id": "daylight",
  "purpose": "A 24-hour dial with noon at the top: one hand revolves per day and the ring shows sunrise to sunset in the accent, the rest in dusk. Sun times come from a local NOAA computation, so there is no offline state.",
  "accent": { "where": "the daylight arc", "color": "--color-accent" },
  "night": {
    "recipe": "Dusk, ticks and ink flip with the palette; the daylight arc stays the accent.",
    "tokens": ["--face-bg", "--face-dusk", "--face-ink", "--face-ink-muted", "--face-tick"]
  },
  "options": [
    { "key": "latitude", "intent": "Leave 0,0 for the schematic 06:00 to 18:00 band; set both coordinates for real sun times." },
    { "key": "longitude", "intent": "Degrees east, negative west; only meaningful together with latitude." },
    { "key": "showTimes", "intent": "Sunrise and sunset labels at the band ends; off for a bare ring." }
  ],
  "antiPatterns": [
    { "rule": "Do not put midnight at the top", "why": "noon at top is the solar convention (hand high means sun high), deliberately opposite to Depletion" }
  ],
  "parity": { "lvgl": null },
  "specless": "One 24-hour solar hand and an arc; the hour, minute and second vocabulary does not describe it."
}
```

`src/apps/clock/StrokesClock.meta.json`
```json
{
  "kind": "face",
  "id": "strokes",
  "purpose": "A full-field lattice of 52 two-hand dials. The centre 4 by 6 block composes the HH and MM digit strokes; everything else parks dim on the south-west diagonal. Perfectly still between minutes.",
  "accent": { "where": "the lit digit strokes", "color": "--color-accent" },
  "night": {
    "recipe": "The ghost hands and the plate flip with the palette; the lit strokes stay the accent.",
    "tokens": ["--face-bg", "--face-ghost", "--face-plate"]
  },
  "options": [
    { "key": "format", "intent": "24 is the default; 12 parks the leading-zero block for hours one to nine." }
  ],
  "antiPatterns": [
    { "rule": "Do not add idle motion between minute steps", "why": "at rest it is perfectly still by decision; the sweep exists only for the hands that change" },
    { "rule": "Do not replace the junction-gap digit font", "why": "the gaps are the font's character, asserted by the geometry test" }
  ],
  "parity": { "lvgl": null },
  "specless": "A lattice of dials; its geometry lives in strokes-geometry.ts."
}
```

- [ ] **Step 5: Write the two widget contracts**

`src/core/widgets/RoundList.meta.json`
```json
{
  "kind": "widget",
  "id": "round-list",
  "purpose": "A centre-column vertical list for the round viewport: about 62 percent wide with a 64px edge fade, so rows never touch the invisible corners. The first primitive of the kit; Agents and Todo consume it.",
  "tokens": [],
  "states": [
    { "state": "empty", "recipe": "The required empty node renders in place of the rows; an empty list must say why it is empty." },
    { "state": "scrolling", "recipe": "Rows scroll inside the masked column with pan-y touch and contained overscroll; the header stays fixed above." }
  ],
  "antiPatterns": [
    { "rule": "Do not set itemHeight below 72", "why": "the touch target gets too small for a finger on glass; 96 is the default for that reason" },
    { "rule": "Do not put the header inside the scroll area", "why": "the title and count are the list's fixed frame; scrolling them away loses the context the round crop already squeezes" }
  ]
}
```

`src/apps/agents/StateRing.meta.json`
```json
{
  "kind": "widget",
  "id": "state-ring",
  "purpose": "The always-on-mic indicator: a ring just inside the bezel whose state is the whole message. Idle is near invisible, listening breathes, thinking rotates a conic gap, speaking holds steady.",
  "tokens": [],
  "states": [
    { "state": "idle", "recipe": "The ring at 8 percent opacity; present but not read." },
    { "state": "listening", "recipe": "A 2.4s ease-in-out breathe on the ring." },
    { "state": "thinking", "recipe": "A conic gradient with a 60 degree gap rotating over 3s, masked to the ring width." },
    { "state": "speaking", "recipe": "The ring at full opacity, still." }
  ],
  "antiPatterns": [
    { "rule": "Do not mount it while the app is inactive", "why": "the parent gates rendering on isActive; an unmounted ring is the cheapest ring on a Pi that runs for weeks" },
    { "rule": "Do not show it on a device without a microphone", "why": "only Fast carries the Fusion HAT mic; a ring on Small or Square promises listening that cannot happen" }
  ]
}
```

- [ ] **Step 6: Run the gate to verify it passes**

Run: `npx vitest run src/shared/part-contracts.test.ts src/shared/part-meta.test.ts`
Expected: PASS. If an option-key test fails, the schema keys listed in the meta differ from `src/shared/schemas/face.<id>.ts`; fix the meta, never the schema. If a night-token test fails, the TSX does not read the token in the `(--face-x)` form; drop the token from the meta.

- [ ] **Step 7: Record R16 in the catalog**

Add to `scripts/lib/rules.mjs`, after the R15 record inside `RULES`:

```js
  {
    id: 'R16',
    statement:
      'every face and kiosk widget carries a .meta.json beside its component, and every claim in it (night tokens read, option keys, parity path, geometry state) is true of the source',
    why: 'a judgment nobody wrote down gets inferred wrong; a claim nobody checks drifts the first time the component changes',
    checkedBy: 'src/shared/part-contracts.test.ts',
  },
```

Run: `npx vitest run scripts/lib/rules.test.ts`
Expected: PASS (the path exists and ends in `.test.ts`).

- [ ] **Step 8: Mutation-check the gate, restoring the files**

Run each of these, expect FAIL naming the fault, then restore the file with `git checkout -- <file>` or by reverting the edit if the file is untracked:
1. In `MinimalismoClock.meta.json`, add `"--face-plate"` to `night.tokens`: expected FAIL `minimalismo claims --face-plate but src/apps/clock/MinimalismoClock.tsx never reads (--face-plate)`.
2. In `AnalogClock.meta.json`, delete the `showSeconds` option: expected FAIL `analog: options differ from face schema keys`.
3. In `part-meta.ts`, remove `'world'` from `SPEC_PENDING`: expected FAIL `world: add spec (numbers) or specless (reason), or list it on SPEC_PENDING`.

- [ ] **Step 9: Run the full suite and lint**

Run: `npx vitest run && npx eslint . && npx tsc -b`
Expected: all green.

- [ ] **Step 10: Commit (local only)**

```bash
git add scripts/lib/token-rules.d.mts src/shared/part-contracts.test.ts src/apps/clock/*.meta.json src/core/widgets/RoundList.meta.json src/apps/agents/StateRing.meta.json scripts/lib/rules.mjs
git commit -m "feat(contracts): part-contract gate and the fifteen meta files (R16)"
```

---

### Task 3: Analog draws from its contract

**Files:**
- Modify: `src/apps/clock/AnalogClock.meta.json` (add `spec`, set `parity.lvgl`)
- Modify: `src/shared/part-meta.ts` (remove `'analog'` from `SPEC_PENDING`)
- Modify: `src/apps/clock/AnalogClock.tsx`
- Test: `src/shared/part-contracts.test.ts` (existing; the "carrying spec imports its meta" case goes red first)

**Interfaces:**
- Consumes: `specOf`, `resolveSpecColor` from Task 1.
- Produces: the Analog `spec` block Task 5's parity test diffs against.

- [ ] **Step 1: Add the numbers and the parity claim to the meta**

Replace `"parity": { "lvgl": null }` in `src/apps/clock/AnalogClock.meta.json` with:

```json
  "parity": { "lvgl": "slow-native/src/clock_face.c" },
  "spec": {
    "space": 1000,
    "radius": 500,
    "face": { "background": "#000000", "ink": "#ffffff" },
    "hands": {
      "hour": { "tip": 280, "width": 28 },
      "minute": { "tip": 380, "width": 20 },
      "second": { "tip": 350, "tail": 80, "width": 6, "color": "config:accent" }
    },
    "ticks": {
      "hour": { "inner": 420, "outer": 480, "width": 12 },
      "minute": { "inner": 435, "outer": 460, "width": 4 }
    },
    "dot": { "outer": 12, "inner": 6, "outerColor": "config:accent", "innerColor": "#000000" }
  }
```

These are the literals in the current TSX, expressed from the centre: hour hand `y2=220` is a tip of 280; minute `y2=120` is 380; second `y1=580, y2=150` is tail 80, tip 350; hour ticks `y1=20, y2=80` are outer 480, inner 420; minute ticks `y1=40, y2=65` are outer 460, inner 435; the pip circles have radii 12 and 6.

- [ ] **Step 2: Remove analog from SPEC_PENDING and run the gate to verify it fails**

In `src/shared/part-meta.ts`, delete the `'analog',` line from `SPEC_PENDING`.

Run: `npx vitest run src/shared/part-contracts.test.ts`
Expected: FAIL with `src/apps/clock/AnalogClock.tsx carries spec but does not import AnalogClock.meta.json`.

- [ ] **Step 3: Make the TSX draw from the spec**

Replace the whole of `src/apps/clock/AnalogClock.tsx` with:

```tsx
import { useClockHands } from '../../core/hooks/useClockHands';
import { analogFaceSchema } from '../../shared/schemas/face.analog';
import { resolveSpecColor, specOf } from '../../shared/part-meta';
import analogMeta from './AnalogClock.meta.json';
import type { FaceProps } from './face-components';

const ROMAN = ['XII', 'I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'XI'];

// Every hand, tick and dot number comes from the contract beside this file;
// the parity test diffs slow-native/src/clock_face.c against the same numbers.
// The numeral ring (radius 340, 72px type) is not in the spec vocabulary and
// stays here on purpose.
const spec = specOf(analogMeta, 'AnalogClock.meta.json');
const tickSpec = spec.ticks;
const dotSpec = spec.dot;
const secondSpec = spec.hands.second;
if (!tickSpec || !dotSpec || !secondSpec) {
  throw new Error('AnalogClock.meta.json spec must declare ticks, dot and a second hand');
}
const C = spec.space / 2;

/** Swiss railway-style analog clock — based on Figma S10 design (489:21023) */
export default function AnalogClock({ isActive, faceConfig }: FaceProps) {
  const { hourDeg, minuteDeg, secondDeg } = useClockHands(isActive);

  // Admin-configured face options (schema fills defaults; invalid saved
  // values fall back to pure defaults rather than crashing the kiosk).
  const parsed = analogFaceSchema.safeParse(faceConfig ?? {});
  const { accent, numeralStyle, showSeconds } = parsed.success
    ? parsed.data
    : analogFaceSchema.parse({});
  const colors = { accent };
  const ink = resolveSpecColor(spec.face.ink, colors);
  const background = resolveSpecColor(spec.face.background, colors);

  // Generate tick marks
  const ticks = [];
  for (let i = 0; i < 60; i++) {
    const isHour = i % 5 === 0;
    const t = isHour ? tickSpec.hour : tickSpec.minute;
    ticks.push(
      <line
        key={i}
        x1={C}
        y1={C - t.outer}
        x2={C}
        y2={C - t.inner}
        stroke={ink}
        strokeWidth={t.width}
        strokeLinecap="round"
        transform={`rotate(${i * 6} ${C} ${C})`}
      />,
    );
  }

  // Hour numerals ring, just inside the ticks.
  const numerals =
    numeralStyle === 'none'
      ? null
      : Array.from({ length: 12 }, (_, i) => {
          const angle = (i * 30 * Math.PI) / 180;
          const r = 340;
          const x = C + r * Math.sin(angle);
          const y = C - r * Math.cos(angle);
          const label = numeralStyle === 'roman' ? ROMAN[i] : String(i === 0 ? 12 : i);
          return (
            <text
              key={i}
              x={x}
              y={y}
              fill={ink}
              fontSize="72"
              fontWeight="500"
              textAnchor="middle"
              dominantBaseline="central"
            >
              {label}
            </text>
          );
        });

  const hand = (deg: number, tip: number, width: number, stroke: string, tail = 0, style = {}) => (
    <line
      x1={C}
      y1={C + tail}
      x2={C}
      y2={C - tip}
      stroke={stroke}
      strokeWidth={width}
      strokeLinecap="round"
      style={{ transform: `rotate(${deg}deg)`, transformOrigin: `${C}px ${C}px`, ...style }}
    />
  );

  return (
    <div className="flex h-full w-full items-center justify-center bg-black">
      <svg viewBox={`0 0 ${spec.space} ${spec.space}`} className="h-full w-full max-h-screen max-w-screen">
        {/* Clock face */}
        <circle cx={C} cy={C} r={spec.radius} fill={background} />

        {/* Tick marks */}
        <g>{ticks}</g>

        {numerals}

        {/* Hour hand */}
        {hand(hourDeg, spec.hands.hour.tip, spec.hands.hour.width, resolveSpecColor(spec.hands.hour.color ?? spec.face.ink, colors))}

        {/* Minute hand */}
        {hand(minuteDeg, spec.hands.minute.tip, spec.hands.minute.width, resolveSpecColor(spec.hands.minute.color ?? spec.face.ink, colors))}

        {/* Second hand */}
        {showSeconds &&
          hand(
            secondDeg,
            secondSpec.tip,
            secondSpec.width,
            resolveSpecColor(secondSpec.color ?? spec.face.ink, colors),
            secondSpec.tail ?? 0,
            { transition: 'transform 0.2s cubic-bezier(0.4, 2.08, 0.55, 0.44)' },
          )}

        {/* Center dot */}
        <circle cx={C} cy={C} r={dotSpec.outer} fill={resolveSpecColor(dotSpec.outerColor ?? spec.face.ink, colors)} />
        <circle cx={C} cy={C} r={dotSpec.inner} fill={resolveSpecColor(dotSpec.innerColor ?? spec.face.background, colors)} />
      </svg>
    </div>
  );
}
```

The `#000000` and `#ffffff` literals that were in the TSX now live in the meta; the TSX is outside the token gate's semantic zones (faces are gated on `--face-*` consumption only, and Analog is exempt), so this does not trip `check:tokens`. The numeral `fill="white"` became `ink`, the same colour.

- [ ] **Step 4: Run the gate and the suite to verify green**

Run: `npx vitest run src/shared/part-contracts.test.ts && npx tsc -b && npx eslint src/apps/clock/AnalogClock.tsx`
Expected: PASS, tsc 0, eslint silent. If tsc rejects the JSON import, confirm `npx tsc --showConfig -p tsconfig.app.json | grep resolveJsonModule` prints `true` (it did on 2026-09-05).

- [ ] **Step 5: Prove the face is pixel-identical**

The literals moved; nothing may have changed on glass. Start the dev server on a free port (5180 may be held by another project) and compare the rendered SVG attributes before and after:

```bash
npx vite --port 5181 --strictPort
```

In the browser tool at `http://localhost:5181`, switch the clock to Analog (`window.__nav` in dev; the face cycle is a vertical swipe) and read `document.querySelector('svg').outerHTML`. Repeat on the previous commit (`git stash push -u -m "analog-spec-check"` then `git stash apply <sha>` afterward, never bare pop: the stash stack is shared across worktrees). The two strings must be identical except for the hand rotation angles, which change with the time. Record the comparison in the agent log entry of Task 8. If the browser cannot be driven, state that the check is unverified in the log; do not claim identity.

- [ ] **Step 6: Commit (local only)**

```bash
git add src/apps/clock/AnalogClock.meta.json src/apps/clock/AnalogClock.tsx src/shared/part-meta.ts
git commit -m "feat(contracts): Analog draws its geometry from AnalogClock.meta.json"
```

---

### Task 4: Minimalismo draws from its contract

**Files:**
- Modify: `src/apps/clock/MinimalismoClock.meta.json` (add `spec`)
- Modify: `src/shared/part-meta.ts` (remove `'minimalismo'` from `SPEC_PENDING`)
- Modify: `src/apps/clock/MinimalismoClock.tsx`

- [ ] **Step 1: Add the numbers to the meta**

Append to `src/apps/clock/MinimalismoClock.meta.json`, after `"parity": { "lvgl": null }` (add the comma):

```json
  "spec": {
    "space": 1000,
    "radius": 500,
    "face": { "background": "--face-bg", "ink": "--face-ink" },
    "hands": {
      "hour": { "tip": 280, "width": 28 },
      "minute": { "tip": 380, "width": 20 },
      "second": { "tip": 350, "tail": 80, "width": 6, "color": "#FFD700" }
    },
    "ticks": null,
    "dot": null
  }
```

- [ ] **Step 2: Remove minimalismo from SPEC_PENDING and watch the gate fail**

Delete the `'minimalismo',` line from `SPEC_PENDING` in `src/shared/part-meta.ts`.

Run: `npx vitest run src/shared/part-contracts.test.ts`
Expected: FAIL with `src/apps/clock/MinimalismoClock.tsx carries spec but does not import MinimalismoClock.meta.json`.

- [ ] **Step 3: Make the TSX draw from the spec**

Replace the whole of `src/apps/clock/MinimalismoClock.tsx` with:

```tsx
import type { AppProps } from '../../core/types';
import { useClockHands } from '../../core/hooks/useClockHands';
import { resolveSpecColor, specOf } from '../../shared/part-meta';
import { handPoints } from './handPoints';
import minimalismoMeta from './MinimalismoClock.meta.json';

/**
 * Minimalismo — pure-white face (black at night via --face-bg/--face-ink tokens), gold smoothly-sweeping
 * second hand. No ticks, numerals, or centre dot. Born on the SuperClock-Slow
 * LVGL prototype (2026-05-09): the ticks failed to render and the bare sweeping
 * face was the keeper.
 *
 * Rendered geometrically (handPoints, no transform/transition) and swept via
 * useClockHands({ sweep: true }) — structurally can't backsweep or float32-jump.
 * Every number comes from MinimalismoClock.meta.json; the token colours stay
 * as classes here so the token and liveness gates see them.
 */
const spec = specOf(minimalismoMeta, 'MinimalismoClock.meta.json');
const secondSpec = spec.hands.second;
if (!secondSpec) throw new Error('MinimalismoClock.meta.json spec must declare a second hand');
const C = spec.space / 2;
const SECOND_COLOR = resolveSpecColor(secondSpec.color ?? spec.face.ink, {});

export default function MinimalismoClock({ isActive }: AppProps) {
  const { hourDeg, minuteDeg, secondDeg } = useClockHands(isActive, { sweep: true });

  return (
    <div className="theme-fade flex h-full w-full items-center justify-center bg-(--face-bg)">
      <svg viewBox={`0 0 ${spec.space} ${spec.space}`} className="h-full w-full max-h-screen max-w-screen">
        <circle cx={C} cy={C} r={spec.radius} className="theme-fade fill-(--face-bg)" />
        {/* Hour */}
        <line {...handPoints(hourDeg, spec.hands.hour.tip)} className="theme-fade stroke-(--face-ink)" strokeWidth={spec.hands.hour.width} strokeLinecap="round" />
        {/* Minute */}
        <line {...handPoints(minuteDeg, spec.hands.minute.tip)} className="theme-fade stroke-(--face-ink)" strokeWidth={spec.hands.minute.width} strokeLinecap="round" />
        {/* Second — gold in both themes, sweeps */}
        <line {...handPoints(secondDeg, secondSpec.tip, secondSpec.tail ?? 0)} stroke={SECOND_COLOR} strokeWidth={secondSpec.width} strokeLinecap="round" />
      </svg>
    </div>
  );
}
```

The `bg-(--face-bg)`, `fill-(--face-bg)` and `stroke-(--face-ink)` classes stay in the TSX on purpose: the contract gate checks that `spec.face` tokens are read by the TSX, the token gate checks the face reads `--face-*`, and the liveness gate counts readers in TSX only.

- [ ] **Step 4: Verify green, lint, typecheck**

Run: `npx vitest run && npx tsc -b && npx eslint src/apps/clock/MinimalismoClock.tsx`
Expected: all green.

- [ ] **Step 5: Prove pixel identity the same way as Task 3 Step 5**, comparing the Minimalismo SVG before and after. Record the result in the Task 8 log entry.

- [ ] **Step 6: Commit (local only)**

```bash
git add src/apps/clock/MinimalismoClock.meta.json src/apps/clock/MinimalismoClock.tsx src/shared/part-meta.ts
git commit -m "feat(contracts): Minimalismo draws its geometry from MinimalismoClock.meta.json"
```

---

### Task 5: LVGL parity parser, drift ledger, and the parity gate

**Files:**
- Create: `scripts/lib/lvgl-parity.mjs`, `scripts/lib/lvgl-parity.d.mts`
- Test: `scripts/lib/lvgl-parity.test.ts` (fixtures), `src/shared/lvgl-parity.test.ts` (real tree)
- Modify: `scripts/lib/rules.mjs` (R10 gains `checkedBy`)

**Interfaces:**
- Consumes: the Analog `spec` from Task 3; `faceMetaSchema` from Task 1; `analogFaceSchema` for the accent default.
- Produces: `GEOM_FIELDS: string[]`, `parseGeom(cSource: string): { geom: Record<string, number>; missing: string[] }`, `parseColors(cSource: string): { face: string | null; hands: Record<string, string | null>; tick: string | null; dots: Record<string, string | null> }`, `compareToSpec(geom, colors, spec, options): Array<{ field: string; react: string | number; lvgl: string | number | null }>`, `PARITY_DRIFT_LEDGER: Array<{ field: string; reason: string }>`.

- [ ] **Step 1: Write the failing fixture tests**

```ts
// scripts/lib/lvgl-parity.test.ts
// Fixture tests for the C parser and the spec comparison. The parser is a
// regex over one file; these cases are what make it fail loudly instead of
// reporting clean when the initializer moves.
import { describe, it, expect } from 'vitest';
import { parseGeom, parseColors, compareToSpec, GEOM_FIELDS, PARITY_DRIFT_LEDGER } from './lvgl-parity.mjs';

const C_SNIPPET = `
#define COLOR_GOLD lv_color_hex(0xFFD700)
static geom_t scale_geom(int32_t viewport_px) {
    double s = viewport_px / 1000.0;
    geom_t g = {
        .center           = viewport_px / 2,
        .face_r           = (int32_t)(460 * s),
        .hour_fwd         = (int32_t)(280 * s),
        .min_fwd          = (int32_t)(380 * s),
        .sec_back         = (int32_t)( 80 * s),
        .sec_fwd          = (int32_t)(350 * s),
        .hour_w           = (int32_t)( 28 * s),
        .min_w            = (int32_t)( 20 * s),
        .sec_w            = (int32_t)(  6 * s),
        .hour_tick_outer  = (int32_t)(440 * s),
        .hour_tick_inner  = (int32_t)(380 * s),
        .min_tick_outer   = (int32_t)(420 * s),
        .min_tick_inner   = (int32_t)(395 * s),
        .hour_tick_w      = (int32_t)( 12 * s),
        .min_tick_w       = (int32_t)(  4 * s),
        .dot_outer        = (int32_t)( 24 * s),
        .dot_inner        = (int32_t)( 12 * s),
    };
    return g;
}
    lv_obj_set_style_bg_color(face, lv_color_white(), 0);
        lv_obj_set_style_line_color(tick, lv_color_black(), 0);
    s->hour = make_hand(parent, lv_color_black(), s->g.hour_w);
    s->min  = make_hand(parent, lv_color_black(), s->g.min_w);
    s->sec  = make_hand(parent, COLOR_GOLD,       s->g.sec_w);
    make_dot(parent, s->g.center, s->g.dot_outer, COLOR_GOLD);
    make_dot(parent, s->g.center, s->g.dot_inner, lv_color_black());
`;

const SPEC = {
  space: 1000,
  radius: 500,
  face: { background: '#000000', ink: '#ffffff' },
  hands: {
    hour: { tip: 280, width: 28 },
    minute: { tip: 380, width: 20 },
    second: { tip: 350, tail: 80, width: 6, color: 'config:accent' },
  },
  ticks: { hour: { inner: 420, outer: 480, width: 12 }, minute: { inner: 435, outer: 460, width: 4 } },
  dot: { outer: 12, inner: 6, outerColor: 'config:accent', innerColor: '#000000' },
};

describe('parseGeom', () => {
  it('reads every geom_t field out of the initializer', () => {
    const { geom, missing } = parseGeom(C_SNIPPET);
    expect(missing).toEqual([]);
    expect(geom.hour_fwd).toBe(280);
    expect(geom.dot_outer).toBe(24);
    expect(Object.keys(geom).sort()).toEqual([...GEOM_FIELDS].sort());
  });

  it('names the fields it could not find when the initializer moved (never reports clean)', () => {
    const { missing } = parseGeom(C_SNIPPET.replace('.hour_fwd         = (int32_t)(280 * s),', ''));
    expect(missing).toEqual(['hour_fwd']);
  });
});

describe('parseColors', () => {
  it('resolves lv_color_white/black, COLOR_* defines and lv_color_hex to #rrggbb', () => {
    const c = parseColors(C_SNIPPET);
    expect(c.face).toBe('#ffffff');
    expect(c.tick).toBe('#000000');
    expect(c.hands).toEqual({ hour: '#000000', min: '#000000', sec: '#ffd700' });
    expect(c.dots).toEqual({ outer: '#ffd700', inner: '#000000' });
  });

  it('returns null for a colour it cannot read, so the comparison reports it', () => {
    const c = parseColors(C_SNIPPET.replace('lv_obj_set_style_bg_color(face, lv_color_white(), 0);', ''));
    expect(c.face).toBeNull();
  });
});

describe('compareToSpec', () => {
  const { geom } = parseGeom(C_SNIPPET);
  const colors = parseColors(C_SNIPPET);
  const mismatches = compareToSpec(geom, colors, SPEC, { accent: '#FFD700' });
  const fields = mismatches.map((m) => m.field).sort();

  it('reports the known Analog drift and nothing else', () => {
    expect(fields).toEqual(
      ['face.background', 'face.ink', 'radius', 'ticks.hour.inner', 'ticks.hour.outer', 'ticks.minute.inner', 'ticks.minute.outer'].sort(),
    );
  });

  it('compares dot radii against C diameters and config colours against the option default', () => {
    expect(fields).not.toContain('dot.outer');
    expect(fields).not.toContain('hands.second.color');
    expect(fields).not.toContain('dot.outerColor');
  });

  it('carries both sides in each mismatch', () => {
    const r = mismatches.find((m) => m.field === 'radius');
    expect(r).toEqual({ field: 'radius', react: 500, lvgl: 460 });
  });

  it('reports a missing C colour as a mismatch against null', () => {
    const noFace = { ...colors, face: null };
    expect(compareToSpec(geom, noFace, SPEC, { accent: '#FFD700' }).find((m) => m.field === 'face.background')?.lvgl).toBeNull();
  });
});

describe('PARITY_DRIFT_LEDGER', () => {
  it('every entry names a field and a reason a reviewer can act on', () => {
    for (const e of PARITY_DRIFT_LEDGER) {
      expect(e.field).toMatch(/^[a-z][\w.]*$/);
      expect(e.reason.length, e.field).toBeGreaterThanOrEqual(30);
    }
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `npx vitest run scripts/lib/lvgl-parity.test.ts`
Expected: FAIL with `Cannot find module './lvgl-parity.mjs'`.

- [ ] **Step 3: Write the parser module and its types**

```js
// scripts/lib/lvgl-parity.mjs
// React ↔ LVGL parity for the one face both renderers draw. Reads the geom_t
// initializer and the colour calls out of slow-native/src/clock_face.c and
// diffs them against the face's meta spec. Fs-free like token-rules.mjs; the
// real-tree gate (src/shared/lvgl-parity.test.ts) reads the files.
//
// A regex parser over one file is enough for one initializer, on one
// condition: it must never report clean because the initializer moved.
// parseGeom therefore returns the fields it could NOT find, and the gate
// fails on any. Colours it cannot read come back null and show up as
// mismatches against null.

export const GEOM_FIELDS = [
  'face_r',
  'hour_fwd',
  'min_fwd',
  'sec_back',
  'sec_fwd',
  'hour_w',
  'min_w',
  'sec_w',
  'hour_tick_outer',
  'hour_tick_inner',
  'min_tick_outer',
  'min_tick_inner',
  'hour_tick_w',
  'min_tick_w',
  'dot_outer',
  'dot_inner',
];

/** `.hour_fwd = (int32_t)(280 * s),` → { hour_fwd: 280 }. Only the
 *  1000-space constants are read; `.center = viewport_px / 2` is not one. */
export function parseGeom(cSource) {
  const geom = {};
  for (const m of cSource.matchAll(/\.(\w+)\s*=\s*\(int32_t\)\(\s*(\d+)\s*\*\s*s\s*\)/g)) {
    geom[m[1]] = Number(m[2]);
  }
  const missing = GEOM_FIELDS.filter((f) => !(f in geom));
  return { geom, missing };
}

function colorOf(expr, defines) {
  const e = expr.trim();
  if (e === 'lv_color_white()') return '#ffffff';
  if (e === 'lv_color_black()') return '#000000';
  if (defines[e]) return defines[e];
  const hex = /lv_color_hex\(0x([0-9a-fA-F]{6})\)/.exec(e);
  return hex ? `#${hex[1].toLowerCase()}` : null;
}

export function parseColors(cSource) {
  const defines = {};
  for (const m of cSource.matchAll(/#define\s+(COLOR_\w+)\s+lv_color_hex\(0x([0-9a-fA-F]{6})\)/g)) {
    defines[m[1]] = `#${m[2].toLowerCase()}`;
  }
  const face = /set_style_bg_color\(face,\s*([^,]+),/.exec(cSource);
  const tick = /set_style_line_color\(tick,\s*([^,]+),/.exec(cSource);
  const hands = {};
  for (const m of cSource.matchAll(/make_hand\(parent,\s*([^,]+),\s*s->g\.(hour|min|sec)_w\)/g)) {
    hands[m[2]] = colorOf(m[1], defines);
  }
  const dots = {};
  for (const m of cSource.matchAll(/make_dot\(parent,\s*s->g\.center,\s*s->g\.dot_(outer|inner),\s*([^)]+)\)/g)) {
    dots[m[1]] = colorOf(m[2], defines);
  }
  return {
    face: face ? colorOf(face[1], defines) : null,
    hands,
    tick: tick ? colorOf(tick[1], defines) : null,
    dots,
  };
}

/** Spec colours for comparison: config:<key> reads the option default the
 *  gate passes in; a --token cannot equal a C literal and stays as-is (a
 *  real mismatch, ledgered with its reason); literals are lower-cased. */
function specColor(value, options) {
  if (value === undefined) return undefined;
  if (value.startsWith('config:')) {
    const v = options[value.slice('config:'.length)];
    return typeof v === 'string' ? v.toLowerCase() : null;
  }
  return value.toLowerCase();
}

/** Every spec field that has a C twin, with the number the twin holds. Dot
 *  values are radii in the spec and diameters in C. */
export function compareToSpec(geom, colors, spec, options) {
  const out = [];
  const check = (field, react, lvgl) => {
    if (react === undefined) return;
    if (react !== lvgl) out.push({ field, react, lvgl: lvgl ?? null });
  };
  const num = (name) => (name in geom ? geom[name] : null);

  check('radius', spec.radius, num('face_r'));
  check('hands.hour.tip', spec.hands.hour.tip, num('hour_fwd'));
  check('hands.hour.width', spec.hands.hour.width, num('hour_w'));
  check('hands.minute.tip', spec.hands.minute.tip, num('min_fwd'));
  check('hands.minute.width', spec.hands.minute.width, num('min_w'));
  if (spec.hands.second) {
    check('hands.second.tip', spec.hands.second.tip, num('sec_fwd'));
    check('hands.second.tail', spec.hands.second.tail ?? 0, num('sec_back'));
    check('hands.second.width', spec.hands.second.width, num('sec_w'));
    check('hands.second.color', specColor(spec.hands.second.color ?? spec.face.ink, options), colors.hands.sec ?? null);
  }
  if (spec.ticks) {
    check('ticks.hour.outer', spec.ticks.hour.outer, num('hour_tick_outer'));
    check('ticks.hour.inner', spec.ticks.hour.inner, num('hour_tick_inner'));
    check('ticks.hour.width', spec.ticks.hour.width, num('hour_tick_w'));
    check('ticks.minute.outer', spec.ticks.minute.outer, num('min_tick_outer'));
    check('ticks.minute.inner', spec.ticks.minute.inner, num('min_tick_inner'));
    check('ticks.minute.width', spec.ticks.minute.width, num('min_tick_w'));
  }
  if (spec.dot) {
    const half = (name) => (num(name) === null ? null : num(name) / 2);
    check('dot.outer', spec.dot.outer, half('dot_outer'));
    check('dot.inner', spec.dot.inner, half('dot_inner'));
    check('dot.outerColor', specColor(spec.dot.outerColor ?? spec.face.ink, options), colors.dots.outer ?? null);
    check('dot.innerColor', specColor(spec.dot.innerColor ?? spec.face.background, options), colors.dots.inner ?? null);
  }
  check('face.background', specColor(spec.face.background, options), colors.face);
  check('face.ink', specColor(spec.face.ink, options), colors.hands.hour ?? null);
  return out;
}

// The React-versus-C mismatches known today, each with the reason it is not
// fixed here. May only SHRINK: resolving one means deleting its line in the
// same change that fixes a renderer. A mismatch not listed fails the gate; a
// listed field that no longer mismatches fails as stale. Which side is right
// is a palette decision for Nick (AGENTS.md: a red check on a deliberate
// design is a conversation, not a fix-forward).
export const PARITY_DRIFT_LEDGER = [
  { field: 'face.background', reason: 'React draws a black dial, the C a white one; the two renderers were never reconciled' },
  { field: 'face.ink', reason: 'React ink is white on black, C ink is black on white; follows the background decision' },
  { field: 'radius', reason: 'React fills the whole 1000 disc; the C draws a 460 face inside a black backdrop' },
  { field: 'ticks.hour.outer', reason: 'the C ticks sit 40 units inside the React ones because its face radius is 460' },
  { field: 'ticks.hour.inner', reason: 'the C ticks sit 40 units inside the React ones because its face radius is 460' },
  { field: 'ticks.minute.outer', reason: 'the C ticks sit 40 units inside the React ones because its face radius is 460' },
  { field: 'ticks.minute.inner', reason: 'the C ticks sit 40 units inside the React ones because its face radius is 460' },
];
```

```ts
// scripts/lib/lvgl-parity.d.mts
export interface ParsedGeom {
  geom: Record<string, number>;
  missing: string[];
}
export interface ParsedColors {
  face: string | null;
  hands: Record<string, string | null>;
  tick: string | null;
  dots: Record<string, string | null>;
}
export interface Mismatch {
  field: string;
  react: string | number | null;
  lvgl: string | number | null;
}
export interface DriftEntry {
  field: string;
  reason: string;
}
export declare const GEOM_FIELDS: string[];
export declare function parseGeom(cSource: string): ParsedGeom;
export declare function parseColors(cSource: string): ParsedColors;
export declare function compareToSpec(
  geom: Record<string, number>,
  colors: ParsedColors,
  spec: unknown,
  options: Record<string, unknown>,
): Mismatch[];
export declare const PARITY_DRIFT_LEDGER: DriftEntry[];
```

- [ ] **Step 4: Run the fixture tests to verify they pass**

Run: `npx vitest run scripts/lib/lvgl-parity.test.ts`
Expected: PASS, 9 tests. If `compareToSpec` reports a field the fixture does not expect, the parser or the mapping is wrong, not the fixture: the fixture encodes the C file as it is on 2026-09-05.

- [ ] **Step 5: Write the failing real-tree gate**

```ts
// src/shared/lvgl-parity.test.ts
// R10 as a detector: the face that claims LVGL parity is diffed, number by
// number and colour by colour, against slow-native/src/clock_face.c. Known
// drift lives in PARITY_DRIFT_LEDGER with a reason; anything else is red.
import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { faceMetaSchema } from './part-meta';
import { SCHEMAS } from './schema-registry';
import { FACES } from './face-registry';
import { parseGeom, parseColors, compareToSpec, PARITY_DRIFT_LEDGER } from '../../scripts/lib/lvgl-parity.mjs';

const parityFaces = readdirSync('src/apps/clock')
  .filter((f) => f.endsWith('.meta.json'))
  .map((f) => faceMetaSchema.parse(JSON.parse(readFileSync(`src/apps/clock/${f}`, 'utf8'))))
  .filter((m) => m.parity.lvgl !== null);

describe('React ↔ LVGL parity', () => {
  it('exactly one face claims the C file today (the parser reads one initializer)', () => {
    expect(parityFaces.map((m) => m.id)).toEqual(['analog']);
  });

  for (const meta of parityFaces) {
    const cSource = readFileSync(meta.parity.lvgl!, 'utf8');
    const { geom, missing } = parseGeom(cSource);
    const colors = parseColors(cSource);
    const schemaId = FACES.find((f) => f.id === meta.id)?.configSchemaId;
    const defaults = schemaId ? (SCHEMAS[schemaId].schema.parse({}) as Record<string, unknown>) : {};
    const mismatches = compareToSpec(geom, colors, meta.spec, defaults);
    const ledgered = new Set(PARITY_DRIFT_LEDGER.map((e) => e.field));

    it(`${meta.id}: the C initializer is fully readable (a moved initializer must not read as clean)`, () => {
      expect(missing, `geom_t fields not found in ${meta.parity.lvgl}: ${missing.join(', ')}`).toEqual([]);
    });

    it(`${meta.id}: every React-versus-C mismatch is in PARITY_DRIFT_LEDGER with a reason`, () => {
      const silent = mismatches.filter((m) => !ledgered.has(m.field));
      expect(
        silent,
        `unledgered drift: ${silent.map((m) => `${m.field} (react ${m.react}, lvgl ${m.lvgl})`).join('; ')}. Add a ledger entry with the reason, or reconcile the renderer that is wrong.`,
      ).toEqual([]);
    });

    it(`${meta.id}: no ledger entry is stale (the list may only shrink)`, () => {
      const fields = new Set(mismatches.map((m) => m.field));
      const stale = PARITY_DRIFT_LEDGER.filter((e) => !fields.has(e.field)).map((e) => e.field);
      expect(stale, `ledger entries that no longer mismatch: ${stale.join(', ')}. Delete them.`).toEqual([]);
    });
  }
});
```

- [ ] **Step 6: Run the real-tree gate**

Run: `npx vitest run src/shared/lvgl-parity.test.ts`
Expected: PASS on day one, because the ledger already names the seven mismatches. If the "every mismatch is ledgered" case fails, the real C file differs from the fixture: read the failure, and only if the reported field is genuinely a mismatch add it to the ledger with its reason. If the "stale" case fails, delete that entry. The ledger must match the tree, not this plan.

- [ ] **Step 7: Flip R10 to a detector**

In `scripts/lib/rules.mjs`, replace the R10 record's `unchecked:` line with:

```js
    checkedBy: 'src/shared/lvgl-parity.test.ts',
```

and delete the `unchecked:` property of that record entirely (a record may not carry both).

Run: `npx vitest run scripts/lib/rules.test.ts && npm run check:tokens`
Expected: PASS; the check:tokens epilogue now lists 6 unchecked rules and R10 is not among them.

- [ ] **Step 8: Mutation-check, restoring afterward**

1. Change `280` to `281` in the `.hour_fwd` line of `slow-native/src/clock_face.c`: expected FAIL `unledgered drift: hands.hour.tip (react 280, lvgl 281)`. Restore with `git checkout -- slow-native/src/clock_face.c`.
2. Remove the `radius` entry from `PARITY_DRIFT_LEDGER`: expected FAIL `unledgered drift: radius`. Restore.

- [ ] **Step 9: Commit (local only)**

```bash
git add scripts/lib/lvgl-parity.mjs scripts/lib/lvgl-parity.d.mts scripts/lib/lvgl-parity.test.ts src/shared/lvgl-parity.test.ts scripts/lib/rules.mjs
git commit -m "feat(contracts): LVGL parity parser, drift ledger, and gate (R10 gets a detector)"
```

---

### Task 6: The parts index

**Files:**
- Create: `scripts/lib/parts-index.mjs`, `scripts/lib/parts-index.d.mts`, `scripts/build-index.mjs`, `index/parts.toon`
- Test: `scripts/lib/parts-index.test.ts` (fixtures), `src/shared/parts-index.test.ts` (drift)
- Modify: `package.json` (`build:index`), `src/shared/part-contracts.test.ts` (import `WIDGET_META_PATHS`), `scripts/lib/rules.mjs` (R17)

**Interfaces:**
- Produces: `WIDGET_META_PATHS: string[]`, `INDEX_COLUMNS: string[]`, `firstSentence(text: string): string`, `partRow(meta: unknown, path: string): Row`, `emitIndex(rows: Row[]): string`, `collectMetaPaths(globSync: (pattern: string) => string[]): string[]`.

- [ ] **Step 1: Write the failing fixture tests**

```ts
// scripts/lib/parts-index.test.ts
import { describe, it, expect } from 'vitest';
import { firstSentence, partRow, emitIndex, collectMetaPaths, INDEX_COLUMNS, WIDGET_META_PATHS } from './parts-index.mjs';

const FACE = {
  kind: 'face',
  id: 'analog',
  purpose: 'The Swiss railway reference. It is the face the LVGL client mirrors.',
  accent: { where: 'seconds', color: 'config:accent' },
  night: { recipe: 'ignores night, legacy exempt face', tokens: [] },
  options: [],
  antiPatterns: [{ rule: 'x', why: 'y' }],
  parity: { lvgl: 'slow-native/src/clock_face.c' },
  spec: { space: 1000 },
};
const WIDGET = { kind: 'widget', id: 'round-list', purpose: 'A centre-column list, with a fade.', tokens: [], states: [], antiPatterns: [] };

describe('firstSentence', () => {
  it('cuts at the first sentence end and keeps the period', () => {
    expect(firstSentence(FACE.purpose)).toBe('The Swiss railway reference.');
  });
  it('returns the whole text when there is one sentence', () => {
    expect(firstSentence('One sentence only')).toBe('One sentence only');
  });
});

describe('partRow', () => {
  it('summarises a face: accent colour, parity, geometry state, first sentence', () => {
    expect(partRow(FACE, 'src/apps/clock/AnalogClock.meta.json')).toEqual({
      kind: 'face',
      id: 'analog',
      path: 'src/apps/clock/AnalogClock.meta.json',
      accent: 'config:accent',
      parity: 'lvgl',
      geometry: 'spec',
      purpose: 'The Swiss railway reference.',
    });
  });
  it('marks specless and pending faces, and dashes the face-only columns for widgets', () => {
    const { spec: _s, ...pending } = FACE;
    void _s;
    expect(partRow(pending, 'p').geometry).toBe('pending');
    expect(partRow({ ...pending, specless: 'a lattice' }, 'p').geometry).toBe('specless');
    expect(partRow({ ...pending, accent: null, parity: { lvgl: null } }, 'p')).toMatchObject({ accent: 'none', parity: 'none' });
    expect(partRow(WIDGET, 'w')).toMatchObject({ kind: 'widget', accent: '-', parity: '-', geometry: '-' });
  });
});

describe('emitIndex', () => {
  it('emits a TOON table sorted by kind then id, quoting fields that carry commas or quotes', () => {
    const rows = [partRow(WIDGET, 'w.json'), partRow(FACE, 'a.json')];
    const out = emitIndex(rows);
    expect(out.split('\n')[0]).toBe(`parts[2]{${INDEX_COLUMNS.join(',')}}:`);
    expect(out).toContain('  face,analog,a.json,config:accent,lvgl,spec,The Swiss railway reference.\n');
    expect(out).toContain('  widget,round-list,w.json,-,-,-,"A centre-column list, with a fade."\n');
    expect(out.indexOf('  face,')).toBeLessThan(out.indexOf('  widget,'));
    expect(out.endsWith('\n')).toBe(true);
  });
  it('is deterministic for the same rows in any order', () => {
    const a = emitIndex([partRow(WIDGET, 'w'), partRow(FACE, 'a')]);
    const b = emitIndex([partRow(FACE, 'a'), partRow(WIDGET, 'w')]);
    expect(a).toBe(b);
  });
});

describe('collectMetaPaths', () => {
  it('returns the clock metas from the glob plus the widget paths, sorted', () => {
    const paths = collectMetaPaths((p) => (p === 'src/apps/clock/*.meta.json' ? ['src/apps/clock/B.meta.json', 'src/apps/clock/A.meta.json'] : []));
    expect(paths).toEqual(['src/apps/clock/A.meta.json', 'src/apps/clock/B.meta.json', ...WIDGET_META_PATHS].sort());
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `npx vitest run scripts/lib/parts-index.test.ts`
Expected: FAIL with `Cannot find module './parts-index.mjs'`.

- [ ] **Step 3: Write the emitter and its types**

```js
// scripts/lib/parts-index.mjs
// The parts index: one row per face and kiosk widget, emitted from the meta
// files so it can never disagree with them for long (src/shared/parts-index.test.ts
// fails when the committed index/parts.toon differs from a fresh emit).
// TOON shape, the format the newer design-system repos trained agents on:
//   parts[N]{col,col,...}:
//     value,value,...
// Fs-free; scripts/build-index.mjs and the drift test own the reads.

/** Widget metas live beside their components, which are not all under one
 *  directory yet (StateRing is in the agents app). One list, imported by the
 *  contract gate and the index alike. */
export const WIDGET_META_PATHS = ['src/core/widgets/RoundList.meta.json', 'src/apps/agents/StateRing.meta.json'];

export const INDEX_COLUMNS = ['kind', 'id', 'path', 'accent', 'parity', 'geometry', 'purpose'];

export function firstSentence(text) {
  const i = text.indexOf('. ');
  return (i === -1 ? text : text.slice(0, i + 1)).trim();
}

export function partRow(meta, path) {
  const base = { kind: meta.kind, id: meta.id, path, purpose: firstSentence(meta.purpose) };
  if (meta.kind !== 'face') return { ...base, accent: '-', parity: '-', geometry: '-' };
  return {
    ...base,
    accent: meta.accent ? meta.accent.color : 'none',
    parity: meta.parity.lvgl ? 'lvgl' : 'none',
    geometry: meta.spec ? 'spec' : meta.specless ? 'specless' : 'pending',
  };
}

function quote(value) {
  const s = String(value);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function emitIndex(rows) {
  const sorted = [...rows].sort((a, b) => a.kind.localeCompare(b.kind) || a.id.localeCompare(b.id));
  const lines = [
    `parts[${sorted.length}]{${INDEX_COLUMNS.join(',')}}:`,
    ...sorted.map((r) => '  ' + INDEX_COLUMNS.map((c) => quote(r[c])).join(',')),
  ];
  return lines.join('\n') + '\n';
}

export function collectMetaPaths(globSync) {
  return [...globSync('src/apps/clock/*.meta.json'), ...WIDGET_META_PATHS].sort();
}
```

```ts
// scripts/lib/parts-index.d.mts
export interface IndexRow {
  kind: string;
  id: string;
  path: string;
  accent: string;
  parity: string;
  geometry: string;
  purpose: string;
}
export declare const WIDGET_META_PATHS: string[];
export declare const INDEX_COLUMNS: string[];
export declare function firstSentence(text: string): string;
export declare function partRow(meta: unknown, path: string): IndexRow;
export declare function emitIndex(rows: IndexRow[]): string;
export declare function collectMetaPaths(globSync: (pattern: string) => string[]): string[];
```

- [ ] **Step 4: Run the fixture tests to verify they pass**

Run: `npx vitest run scripts/lib/parts-index.test.ts`
Expected: PASS, 7 tests.

- [ ] **Step 5: Write the runner, the npm script, and the drift gate (red first)**

```js
// scripts/build-index.mjs
// Emit index/parts.toon from every part meta. Run after editing a meta;
// src/shared/parts-index.test.ts fails until the committed file matches.
import { globSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url'; // never URL.pathname — this checkout path contains spaces
import { chdir } from 'node:process';
import { collectMetaPaths, emitIndex, partRow } from './lib/parts-index.mjs';

chdir(fileURLToPath(new URL('..', import.meta.url)));

const rows = collectMetaPaths(globSync).map((path) => partRow(JSON.parse(readFileSync(path, 'utf8')), path));
mkdirSync('index', { recursive: true });
writeFileSync('index/parts.toon', emitIndex(rows));
console.log(`build:index — ${rows.length} part(s) written to index/parts.toon`);
```

Add to `package.json` scripts, after `"new:face"`:

```json
    "build:index": "node scripts/build-index.mjs",
```

```ts
// src/shared/parts-index.test.ts
// The committed index must equal a fresh emit from the meta files. An index
// that lags its sources sends the next session to a part that changed.
import { describe, it, expect } from 'vitest';
import { existsSync, globSync, readFileSync } from 'node:fs';
import { collectMetaPaths, emitIndex, partRow } from '../../scripts/lib/parts-index.mjs';

describe('index/parts.toon', () => {
  it('exists and matches a fresh emit (run: npm run build:index)', () => {
    expect(existsSync('index/parts.toon'), 'index/parts.toon missing: run npm run build:index').toBe(true);
    const fresh = emitIndex(collectMetaPaths(globSync).map((p) => partRow(JSON.parse(readFileSync(p, 'utf8')), p)));
    expect(readFileSync('index/parts.toon', 'utf8'), 'index/parts.toon is stale: run npm run build:index').toBe(fresh);
  });

  it('lists every part once', () => {
    const lines = readFileSync('index/parts.toon', 'utf8').split('\n').filter((l) => l.startsWith('  '));
    expect(lines.length).toBe(collectMetaPaths(globSync).length);
  });
});
```

Run: `npx vitest run src/shared/parts-index.test.ts`
Expected: FAIL with `index/parts.toon missing: run npm run build:index`.

- [ ] **Step 6: Emit the index and verify green**

Run: `npm run build:index && npx vitest run src/shared/parts-index.test.ts && cat index/parts.toon`
Expected: `build:index — 15 part(s) written`, PASS, and the file starts with `parts[15]{kind,id,path,accent,parity,geometry,purpose}:` followed by 13 `face,` rows then 2 `widget,` rows.

- [ ] **Step 7: Point the contract gate at the shared widget list**

In `src/shared/part-contracts.test.ts`, delete the local `WIDGET_META_PATHS` constant and its comment, and add the import:

```ts
import { WIDGET_META_PATHS } from '../../scripts/lib/parts-index.mjs';
```

Run: `npx vitest run src/shared/part-contracts.test.ts`
Expected: PASS.

- [ ] **Step 8: Record R17**

Add to `scripts/lib/rules.mjs`, after R16:

```js
  {
    id: 'R17',
    statement: 'index/parts.toon equals a fresh emit from every part meta (npm run build:index)',
    why: 'the index is the survey an agent reads instead of grepping components; a stale row sends it to a part that changed',
    checkedBy: 'src/shared/parts-index.test.ts',
  },
```

Run: `npx vitest run scripts/lib/rules.test.ts`
Expected: PASS.

- [ ] **Step 9: Mutation-check**

Edit one character of a row in `index/parts.toon`: expected FAIL `index/parts.toon is stale`. Restore with `npm run build:index`.

- [ ] **Step 10: Commit (local only)**

```bash
git add scripts/lib/parts-index.mjs scripts/lib/parts-index.d.mts scripts/lib/parts-index.test.ts scripts/build-index.mjs index/parts.toon src/shared/parts-index.test.ts src/shared/part-contracts.test.ts package.json scripts/lib/rules.mjs
git commit -m "feat(contracts): emitted parts index with drift gate (R17)"
```

---

### Task 7: The scaffolder emits a meta stub

**Files:**
- Modify: `scripts/lib/scaffold-templates.mjs` (add `faceMetaTemplate`)
- Modify: `scripts/new-face.mjs` (write the stub, print the step)
- Test: `scripts/lib/scaffold-templates.test.ts`

**Interfaces:**
- Produces: `faceMetaTemplate(id: string): string` (JSON text).

- [ ] **Step 1: Write the failing tests**

Add to `scripts/lib/scaffold-templates.test.ts`, importing `faceMetaTemplate` from `./scaffold-templates.mjs` alongside the existing imports and `faceMetaSchema` from `../../src/shared/part-meta`:

```ts
describe('face meta template (red-by-construction contract)', () => {
  it('is valid JSON with kind face and the scaffolded id', () => {
    const meta = JSON.parse(faceMetaTemplate(ID));
    expect(meta.kind).toBe('face');
    expect(meta.id).toBe(ID);
  });

  it('claims exactly the tokens the scaffolded component reads', () => {
    const meta = JSON.parse(faceMetaTemplate(ID));
    const component = faceComponentTemplate(ID);
    for (const token of meta.night.tokens) expect(component).toContain(`var(${token})`);
  });

  it('fails the contract schema for the TODO reason and no other', () => {
    const r = faceMetaSchema.safeParse(JSON.parse(faceMetaTemplate(ID)));
    expect(r.success).toBe(false);
    expect(r.error?.issues.length).toBeGreaterThan(0);
    for (const issue of r.error?.issues ?? []) expect(issue.message, issue.path.join('.')).toContain('TODO');
  });
});
```

The component template reads its tokens as `var(--face-bg)` and `var(--face-ink)` in a style object, so the second test matches `var(` rather than the `(--token)` form the gate uses; both contain `(--face-bg)`.

- [ ] **Step 2: Run to verify failure**

Run: `npx vitest run scripts/lib/scaffold-templates.test.ts`
Expected: FAIL, `faceMetaTemplate is not a function` (or undefined export).

- [ ] **Step 3: Add the template**

Add to `scripts/lib/scaffold-templates.mjs`, after `faceSchemaTemplate`:

```js
/** The usage contract stub. Every judgment string begins with TODO, which the
 *  contract schema rejects, so a scaffolded face stays red until its
 *  judgments are written (the same way its todo test keeps it red until it
 *  is implemented). The night tokens match what faceComponentTemplate reads.
 *  specless is the safe default: replace it with spec numbers when the face
 *  is drawn from hands and ticks. */
export function faceMetaTemplate(id) {
  const meta = {
    kind: 'face',
    id,
    purpose: 'TODO: what this face is for and what it refuses to be (40 characters or more)',
    accent: { where: 'TODO: where the one saturated quantity sits', color: '--color-accent' },
    night: {
      recipe: 'TODO: how the --face-* palette flip reaches this face',
      tokens: ['--face-bg', '--face-ink'],
    },
    options: [],
    antiPatterns: [
      {
        rule: 'TODO: the first thing this face must never do',
        why: 'TODO: the reason, because a bare rule gets rationalised away',
      },
    ],
    parity: { lvgl: null },
    specless: 'TODO: replace with a spec block of numbers, or say why this face has no hand geometry',
  };
  return JSON.stringify(meta, null, 2) + '\n';
}
```

- [ ] **Step 4: Run the template tests to verify they pass**

Run: `npx vitest run scripts/lib/scaffold-templates.test.ts`
Expected: PASS.

- [ ] **Step 5: Wire the scaffolder**

In `scripts/new-face.mjs`: add `faceMetaTemplate,` to the import list from `./lib/scaffold-templates.mjs`; add to `newFiles`:

```js
    [`src/apps/clock/${pascal}Clock.meta.json`]: faceMetaTemplate(id),
```

and replace the printed next-steps block with:

```js
  console.log(`new:face — scaffolded '${id}'. Next steps:
  1. Implement ${componentPath} and remove its SCAFFOLD-TODO marker
     (keep consuming --face-* — the token gate holds new faces to it).
  2. Fill in src/shared/schemas/face.${id}.ts (every field needs .default()).
  3. Write src/apps/clock/${pascal}Clock.meta.json: replace every TODO with the
     judgment (purpose, accent, night recipe, an intent per option, anti-patterns
     with the why); use a spec block for a hand-and-tick face, specless otherwise.
     Then npm run build:index. The contract gate is red until this is done.
  4. Drop 1000×1000 preview art at public/${id}-preview.png and set the real
     category in src/shared/face-registry.ts.
  5. Delete src/apps/clock/${id}.todo.test.ts once implemented.
  6. npm test && npm run check:tokens — both must be green before "done".
  7. Shared-face parity: if this face will exist on superclock-slow too, set
     parity.lvgl in the meta and plan the LVGL sibling (AGENTS.md "React <-> LVGL face parity").`);
```

- [ ] **Step 6: Smoke-test the scaffolder end to end, then revert everything it wrote**

```bash
npm run new:face -- probe && npx vitest run src/shared/part-contracts.test.ts src/shared/parts-index.test.ts; git status --short
```

Expected: the contract gate FAILS for `probe` with messages containing `TODO` only (the options test passes: the scaffolded schema has no keys and the stub has `options: []`); the index test FAILS as stale (the new meta is not in the committed index). Then revert every file the scaffolder touched:

```bash
git checkout -- src/apps/clock/face-components.ts src/shared/face-registry.ts src/shared/schema-registry.ts
rm src/apps/clock/ProbeClock.tsx src/apps/clock/ProbeClock.meta.json src/apps/clock/probe.todo.test.ts src/shared/schemas/face.probe.ts
git status --short
```

Expected: only the files this task changes remain modified. Run `npx vitest run` to confirm green again.

- [ ] **Step 7: Commit (local only)**

```bash
git add scripts/lib/scaffold-templates.mjs scripts/lib/scaffold-templates.test.ts scripts/new-face.mjs
git commit -m "feat(scaffold): new:face emits a meta stub that keeps the contract gate red until filled"
```

---

### Task 8: The rule in AGENTS.md, the record, and the full gates

**Files:**
- Modify: `AGENTS.md`, `docs/agent-log.md`, `docs/superpowers/specs/2026-09-05-face-contracts-design.md` (changelog)

- [ ] **Step 1: Add the rule and fix the parity line in AGENTS.md**

In the `### Conventions` list, add a first bullet:

```markdown
- **Parts carry contracts.** Before adding or changing a face or widget, read `index/parts.toon`, then the part's `.meta.json` beside its component. The meta is the contract (judgments, the night recipe, the one accent, and for hand-and-tick faces the numbers it is drawn from); the TSX is the implementation. Run `npm run build:index` after editing a meta; `src/shared/part-contracts.test.ts` gates every claim, `src/shared/lvgl-parity.test.ts` diffs the LVGL C constants against the Analog spec, with known drift ledgered in `PARITY_DRIFT_LEDGER` (shrink-only; which renderer is right is a design decision, not a fix-forward).
```

In `### React ↔ LVGL face parity`, replace `(currently Minimalismo)` with `(currently Analog: the C file is the Swiss-railway face, and the parity test says where the two disagree)`.

In `## Known gaps`, replace the bullet beginning `**The one-accent-quantity rule and LVGL parity are review-enforced, not gated**` with:

```markdown
- **The one-accent-quantity rule is declared as data (`accent` in each face meta) but its rendered check is still review-enforced** (R09). LVGL parity is gated (R10, `src/shared/lvgl-parity.test.ts`); the ledgered drift is a decision waiting on Nick.
```

- [ ] **Step 2: Add the spec changelog line**

Append to the spec's `## Changelog`:

```markdown
- <date of execution>: implemented per `docs/superpowers/plans/2026-09-05-face-contracts.md`; meta filenames are `<ComponentFunctionName>.meta.json` (`AnalogClock.meta.json`, not `Analog.meta.json`).
```

- [ ] **Step 3: Run the full local CI mirror**

Run: `./scripts/gates.sh`
Expected: `gates: all 4 green.`; the check:tokens epilogue lists 7 ledgered tokens and 6 unchecked rules.

- [ ] **Step 4: Write the agent-log entry**

Add a new entry at the top of `docs/agent-log.md` (after the intro and the `---`), following the existing entries' shape: date, branch, "design-system step 3: face and widget contracts built". Under **Changed** list every file from this plan's file map. Under **Verified** state the gates result, the mutation checks that were run and what they named, and the pixel-identity check for Analog and Minimalismo (or that it is unverified, with why). Under **Decisions** list the seven ledgered parity mismatches with their reasons and the six faces on `SPEC_PENDING`. Under **Open** list Nick's review of the fifteen judgment drafts, the Analog drift decision, and StateRing's home.

- [ ] **Step 5: Commit (local only)**

```bash
git add AGENTS.md docs/agent-log.md docs/superpowers/specs/2026-09-05-face-contracts-design.md
git commit -m "docs(contracts): the parts rule in AGENTS.md, spec changelog, agent log"
```

---

## Self-review against the spec

- **Scope:** faces (13) in Tasks 2 to 4, widgets (2) in Task 2, admin surfaces deferred: covered.
- **The file:** every field and gate in the spec's two tables has a schema rule (Task 1) or a gate case (Task 2); `id` equals the registry id via `FACE_COMPONENTS` keys; unknown fields rejected (`.strict()`).
- **Numbers block:** vocabulary and C twins implemented in Task 5's `compareToSpec`; dot radii versus C diameters handled.
- **Who reads it:** TSX (Tasks 3, 4), parity test (Task 5), index (Task 6), scaffolder (Task 7), AGENTS.md rule (Task 8).
- **Shrink-only lists:** `SPEC_PENDING` (Task 1, gated in Task 2, shrunk in Tasks 3 and 4), `PARITY_DRIFT_LEDGER` (Task 5, stale check).
- **Gates table:** validity, one per part, claims, geometry state, structural read (Task 2); parity (Task 5); index (Task 6); scaffold template (Task 7). R10, R16, R17 recorded in Tasks 5, 2, 6.
- **Success criteria:** gates green (Task 8), 15 parts in the index (Task 6), Analog and Minimalismo hold no hand, tick or dot literals (Tasks 3, 4), every Analog mismatch ledgered (Task 5), scaffolded face red for TODO only (Task 7), R10 not unchecked (Task 5).
- **Out of scope honoured:** no engine, no admin metas, no drift fix, no other face migrations, no Figma sync, StateRing stays put.
- **Type consistency:** `specOf`, `resolveSpecColor`, `SPEC_PENDING`, `WIDGET_META_PATHS`, `partRow`, `emitIndex`, `collectMetaPaths`, `parseGeom`, `parseColors`, `compareToSpec`, `PARITY_DRIFT_LEDGER`, `faceMetaTemplate` are named identically everywhere they appear.
