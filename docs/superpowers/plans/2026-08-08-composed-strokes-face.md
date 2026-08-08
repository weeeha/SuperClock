# Composed Strokes Face Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship the `strokes` clock face — a full-field lattice of 52 two-hand dials whose centre 24 compose HH/MM digits, per `docs/superpowers/specs/2026-08-08-composed-strokes-face-design.md`.

**Architecture:** A pure geometry module (`strokes-geometry.ts`) owns the lattice, the digit font, time→target mapping, and the step model (cumulative clockwise angles + animate/snap decision). `StrokesClock.tsx` is a thin renderer: derive-model-during-render (`useState` + key-guarded render-phase set — React-Compiler-safe, no ref reads in render), one CSS-transitioned `<g>` per hand. Registry wiring follows the Depletion precedent exactly.

**Tech Stack:** React 19 + TS (verbatimModuleSyntax, no enums), zod, Vitest, Tailwind v4 tokens in `src/index.css`.

## Global Constraints

- No `setInterval` in `src/apps/clock/` (ESLint-banned) — time comes from `useClockHands(isActive)`.
- Background apps must not tick: `isActive` gates the hook; inactive ⇒ frozen time ⇒ no model steps.
- Type-only imports must use `import type`.
- Colors only via tokens: `var(--face-*)`, `var(--color-accent)` — no hex in components.
- Registry coherence: `FACE_COMPONENTS` keys ↔ `FACES` ids ↔ `face.*` schema ids must all agree or `npm test` fails.
- Render space 1000×1000, wrapper `div.theme-fade … bg-(--face-bg)` (Depletion precedent).

---

### Task 1: Geometry module (TDD)

**Files:**
- Create: `src/apps/clock/strokes-geometry.ts`
- Test: `src/apps/clock/strokes-geometry.test.ts`

**Interfaces:**
- Produces: `PITCH=110`, `DIAL_R=51`, `HAND_LEN=54`, `PARK_ANGLE=225`, `type StrokesFormat = '24'|'12'`, `interface Cell {col,row,cx,cy}`, `buildLattice(): Cell[]` (row-major, 52 cells), `DIGIT_FONT` (10 glyphs × 6 cells, `readonly [number,number] | null`), `composeTargets(hours, minutes, format): Map<string, HandPair|null>` (keys `"col,row"`, 24 core cells), `advanceClockwise(prev, target): number`, `interface StrokesModel {key, minuteOfDay, format, angles: number[], parked: boolean[], moved: boolean[], delayRank: number[], animate: boolean}`, `stepModel(prev: StrokesModel|null, lattice, hours, minutes, format): StrokesModel` (angles/moved/delayRank are 2-per-cell index-aligned with lattice; parked is 1-per-cell).

- [ ] **Step 1: Write the failing test** — `src/apps/clock/strokes-geometry.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import {
  DIAL_R,
  DIGIT_FONT,
  PARK_ANGLE,
  advanceClockwise,
  buildLattice,
  composeTargets,
  stepModel,
} from './strokes-geometry';

const CELLS = [0, 1, 2, 3, 4, 5] as const; // TL TR ML MR BL BR
const [TL, TR, ML, MR, BL, BR] = CELLS;
const N = 0, E = 90, S = 180, W = 270;

function hasHand(digit: number, cell: number, angle: number): boolean {
  const pair = DIGIT_FONT[digit][cell];
  return pair !== null && (pair[0] === angle || pair[1] === angle);
}

describe('buildLattice', () => {
  const cells = buildLattice();

  it('produces exactly 52 dials, all fully inside the disc', () => {
    expect(cells).toHaveLength(52);
    for (const c of cells) {
      expect(Math.hypot(c.cx - 500, c.cy - 500) + DIAL_R + 4).toBeLessThanOrEqual(496);
    }
  });

  it('is 4-fold symmetric', () => {
    const keys = new Set(cells.map((c) => `${c.col},${c.row}`));
    for (const c of cells) {
      expect(keys.has(`${-1 - c.col},${c.row}`)).toBe(true);
      expect(keys.has(`${c.col},${-1 - c.row}`)).toBe(true);
    }
  });

  it('contains the whole 4x6 core and is row-major ordered', () => {
    const keys = new Set(cells.map((c) => `${c.col},${c.row}`));
    for (let row = -3; row <= 2; row++)
      for (let col = -2; col <= 1; col++) expect(keys.has(`${col},${row}`)).toBe(true);
    const idx = (col: number, row: number) =>
      cells.findIndex((c) => c.col === col && c.row === row);
    expect(idx(-2, -3)).toBeLessThan(idx(-1, -3));
    expect(idx(1, -3)).toBeLessThan(idx(-2, -2));
  });
});

describe('DIGIT_FONT', () => {
  it('defines ten glyphs of six cells with orthogonal hands only', () => {
    expect(DIGIT_FONT).toHaveLength(10);
    for (const glyph of DIGIT_FONT) {
      expect(glyph).toHaveLength(6);
      for (const pair of glyph) {
        if (pair === null) continue;
        for (const a of pair) expect([N, E, S, W]).toContain(a);
      }
    }
  });

  it('holds the required tip-to-tip continuities per digit', () => {
    // [digit, cellA, angleA, cellB, angleB] — A's hand meets B's hand at the shared edge.
    const REQUIRED: Array<[number, number, number, number, number]> = [
      [0, TL, E, TR, W], [0, TL, S, ML, N], [0, ML, S, BL, N], [0, TR, S, MR, N], [0, MR, S, BR, N], [0, BL, E, BR, W],
      [1, TR, S, MR, N], [1, MR, S, BR, N],
      [2, TL, E, TR, W], [2, TR, S, MR, N], [2, MR, W, ML, E], [2, ML, S, BL, N], [2, BL, E, BR, W],
      [3, TL, E, TR, W], [3, TR, S, MR, N], [3, MR, S, BR, N], [3, BL, E, BR, W],
      [4, TL, S, ML, N], [4, TR, S, MR, N], [4, MR, S, BR, N],
      [5, TL, E, TR, W], [5, TL, S, ML, N], [5, ML, E, MR, W], [5, MR, S, BR, N], [5, BR, W, BL, E],
      [6, TL, E, TR, W], [6, TL, S, ML, N], [6, ML, S, BL, N], [6, MR, S, BR, N], [6, BL, E, BR, W],
      [7, TL, E, TR, W], [7, TR, S, MR, N], [7, MR, S, BR, N],
      [8, TL, E, TR, W], [8, TL, S, ML, N], [8, ML, E, MR, W], [8, TR, S, MR, N], [8, BL, E, BR, W],
      [9, TL, E, TR, W], [9, TL, S, ML, N], [9, TR, S, MR, N], [9, MR, S, BR, N], [9, BL, E, BR, W],
    ];
    for (const [d, cellA, aA, cellB, aB] of REQUIRED) {
      expect(hasHand(d, cellA, aA), `digit ${d} cell ${cellA} angle ${aA}`).toBe(true);
      expect(hasHand(d, cellB, aB), `digit ${d} cell ${cellB} angle ${aB}`).toBe(true);
    }
  });

  it('parks exactly the cells the glyphs leave empty', () => {
    expect(DIGIT_FONT[1][TL]).toBeNull();
    expect(DIGIT_FONT[1][ML]).toBeNull();
    expect(DIGIT_FONT[1][BL]).toBeNull();
    expect(DIGIT_FONT[4][BL]).toBeNull();
    expect(DIGIT_FONT[7][ML]).toBeNull();
    expect(DIGIT_FONT[7][BL]).toBeNull();
  });
});

describe('composeTargets', () => {
  it('24h 05:07 puts 0,5,0,7 in the four blocks', () => {
    const t = composeTargets(5, 7, '24');
    expect(t.size).toBe(24);
    expect(t.get('-2,-3')).toEqual(DIGIT_FONT[0][TL]); // HH tens = 0
    expect(t.get('0,-3')).toEqual(DIGIT_FONT[5][TL]);  // HH ones = 5
    expect(t.get('-2,0')).toEqual(DIGIT_FONT[0][TL]);  // MM tens = 0
    expect(t.get('1,2')).toEqual(DIGIT_FONT[7][BR]);   // MM ones = 7
  });

  it('12h 17:05 blanks the hour-tens block and shows 5:05', () => {
    const t = composeTargets(17, 5, '12');
    for (let row = -3; row <= -1; row++)
      for (let col = -2; col <= -1; col++) expect(t.get(`${col},${row}`)).toBeNull();
    expect(t.get('0,-3')).toEqual(DIGIT_FONT[5][TL]);
  });

  it('midnight: 24h reads 00:00, 12h reads 12:00 with no blank block', () => {
    expect(composeTargets(0, 0, '24').get('-2,-3')).toEqual(DIGIT_FONT[0][TL]);
    const t12 = composeTargets(0, 0, '12');
    expect(t12.get('-2,-3')).toEqual(DIGIT_FONT[1][TL]);
    expect(t12.get('0,-3')).toEqual(DIGIT_FONT[2][TL]);
  });
});

describe('advanceClockwise', () => {
  it('always moves clockwise and never for an equal position', () => {
    expect(advanceClockwise(350, 10)).toBe(370);
    expect(advanceClockwise(10, 10)).toBe(10);
    expect(advanceClockwise(0, 270)).toBe(270);
    expect(advanceClockwise(730, 10)).toBe(1090 - 360); // 730 -> 730 (10 mod 360 == 730 mod 360)
  });
});

describe('stepModel', () => {
  const lattice = buildLattice();

  it('first model snaps (animate=false) and parks every field dial', () => {
    const m = stepModel(null, lattice, 15, 2, '24');
    expect(m.animate).toBe(false);
    expect(m.angles).toHaveLength(lattice.length * 2);
    lattice.forEach((c, i) => {
      const core = c.col >= -2 && c.col <= 1 && c.row >= -3 && c.row <= 2;
      if (!core) {
        expect(m.parked[i]).toBe(true);
        expect(m.angles[2 * i]).toBe(PARK_ANGLE);
        expect(m.angles[2 * i + 1]).toBe(PARK_ANGLE);
      }
    });
  });

  it('a +1 minute step animates and only moves hands whose target changed', () => {
    const a = stepModel(null, lattice, 15, 2, '24');
    const b = stepModel(a, lattice, 15, 3, '24');
    expect(b.animate).toBe(true);
    expect(b.moved.some(Boolean)).toBe(true);
    b.moved.forEach((mv, idx) => {
      if (!mv) expect(b.angles[idx]).toBe(a.angles[idx]);
      else expect(b.angles[idx]).toBeGreaterThan(a.angles[idx]);
    });
  });

  it('23:59 -> 00:00 wraps as a +1 step', () => {
    const a = stepModel(null, lattice, 23, 59, '24');
    const b = stepModel(a, lattice, 0, 0, '24');
    expect(b.animate).toBe(true);
  });

  it('multi-minute jumps and format changes snap', () => {
    const a = stepModel(null, lattice, 15, 2, '24');
    expect(stepModel(a, lattice, 15, 9, '24').animate).toBe(false);
    expect(stepModel(a, lattice, 15, 2, '12').animate).toBe(false);
  });

  it('delayRank ranks changed dials row-major from zero', () => {
    const a = stepModel(null, lattice, 15, 2, '24');
    const b = stepModel(a, lattice, 15, 3, '24');
    const ranks = b.delayRank.filter((_, idx) => b.moved[idx]);
    expect(Math.min(...ranks)).toBe(0);
  });
});
```

- [ ] **Step 2: Run it, expect module-not-found failure**

Run: `npx vitest run src/apps/clock/strokes-geometry.test.ts`
Expected: FAIL — cannot resolve `./strokes-geometry`.

- [ ] **Step 3: Implement `src/apps/clock/strokes-geometry.ts`**

```ts
// Pure geometry for the Composed Strokes face: dial lattice, digit font,
// time -> hand-target mapping, and the cumulative-angle step model.
// Spec: docs/superpowers/specs/2026-08-08-composed-strokes-face-design.md

export const PITCH = 110;
export const DIAL_R = 51;
export const HAND_LEN = 54;
export const PARK_ANGLE = 225;

const CENTER = 500;
const DISC_LIMIT = 496;

export type StrokesFormat = '24' | '12';
export type HandPair = readonly [number, number];

export interface Cell {
  col: number;
  row: number;
  cx: number;
  cy: number;
}

// A cell exists iff its dial (plus a 4-unit breathing margin) fits inside the
// disc. Row-major order so reading-order stagger falls out of the index.
export function buildLattice(): Cell[] {
  const cells: Cell[] = [];
  for (let row = -5; row <= 4; row++) {
    for (let col = -5; col <= 4; col++) {
      const cx = CENTER + (col + 0.5) * PITCH;
      const cy = CENTER + (row + 0.5) * PITCH;
      if (Math.hypot(cx - CENTER, cy - CENTER) + DIAL_R + 4 <= DISC_LIMIT) {
        cells.push({ col, row, cx, cy });
      }
    }
  }
  return cells;
}

// 6 cells per glyph: TL TR / ML MR / BL BR. Angles clockwise from north.
// null = parked. T-junctions are undrawable with two hands; digits 3/4/6/8/9
// carry a deliberate half-cell gap (the font's character — see spec).
export const DIGIT_FONT: ReadonlyArray<ReadonlyArray<HandPair | null>> = [
  /* 0 */ [[90, 180], [270, 180], [0, 180], [0, 180], [0, 90], [0, 270]],
  /* 1 */ [null, [180, 180], null, [0, 180], null, [0, 0]],
  /* 2 */ [[90, 90], [270, 180], [90, 180], [0, 270], [0, 90], [270, 270]],
  /* 3 */ [[90, 90], [270, 180], [90, 90], [0, 180], [90, 90], [0, 270]],
  /* 4 */ [[180, 180], [180, 180], [0, 90], [0, 180], null, [0, 0]],
  /* 5 */ [[90, 180], [270, 270], [0, 90], [270, 180], [90, 90], [0, 270]],
  /* 6 */ [[90, 180], [270, 270], [0, 180], [270, 180], [0, 90], [0, 270]],
  /* 7 */ [[90, 90], [270, 180], null, [0, 180], null, [0, 0]],
  /* 8 */ [[90, 180], [270, 180], [0, 90], [0, 270], [0, 90], [0, 270]],
  /* 9 */ [[90, 180], [270, 180], [0, 90], [0, 180], [90, 90], [0, 270]],
];

// Top-left lattice cell of each 2x3 digit block: HH tens, HH ones, MM tens, MM ones.
const DIGIT_BLOCKS = [
  { col: -2, row: -3 },
  { col: 0, row: -3 },
  { col: -2, row: 0 },
  { col: 0, row: 0 },
] as const;

export function composeTargets(
  hours: number,
  minutes: number,
  format: StrokesFormat,
): Map<string, HandPair | null> {
  let h = hours;
  let blankTens = false;
  if (format === '12') {
    h = hours % 12;
    if (h === 0) h = 12;
    blankTens = h < 10;
  }
  const digits = [Math.floor(h / 10), h % 10, Math.floor(minutes / 10), minutes % 10];
  const out = new Map<string, HandPair | null>();
  DIGIT_BLOCKS.forEach((block, i) => {
    const glyph = blankTens && i === 0 ? null : DIGIT_FONT[digits[i]];
    for (let cell = 0; cell < 6; cell++) {
      const col = block.col + (cell % 2);
      const row = block.row + Math.floor(cell / 2);
      out.set(`${col},${row}`, glyph ? glyph[cell] : null);
    }
  });
  return out;
}

// Cumulative clockwise advance: equal position is a no-op, everything else
// travels the short clockwise way. Angles only ever grow.
export function advanceClockwise(prev: number, target: number): number {
  const delta = (((target - prev) % 360) + 360) % 360;
  return prev + delta;
}

export interface StrokesModel {
  key: string;
  minuteOfDay: number;
  format: StrokesFormat;
  /** cumulative degrees, 2 per lattice cell (index-aligned) */
  angles: number[];
  /** per lattice cell */
  parked: boolean[];
  /** 2 per cell — hand target changed this step */
  moved: boolean[];
  /** 2 per cell — row-major rank of the hand's dial among moved dials */
  delayRank: number[];
  animate: boolean;
}

export function stepModel(
  prev: StrokesModel | null,
  lattice: Cell[],
  hours: number,
  minutes: number,
  format: StrokesFormat,
): StrokesModel {
  const minuteOfDay = hours * 60 + minutes;
  const targets = composeTargets(hours, minutes, format);
  const animate =
    prev !== null &&
    prev.format === format &&
    (minuteOfDay - prev.minuteOfDay + 1440) % 1440 === 1;

  const angles: number[] = [];
  const parked: boolean[] = [];
  const moved: boolean[] = [];
  const delayRank: number[] = [];
  let rank = 0;

  lattice.forEach((cell, i) => {
    const pair = targets.get(`${cell.col},${cell.row}`) ?? null;
    parked.push(pair === null);
    let dialMoved = false;
    for (let j = 0; j < 2; j++) {
      const idx = 2 * i + j;
      const target = pair ? pair[j] : PARK_ANGLE;
      const next = prev ? advanceClockwise(prev.angles[idx], target) : target;
      angles.push(next);
      const didMove = prev !== null && next !== prev.angles[idx];
      moved.push(didMove);
      dialMoved = dialMoved || didMove;
    }
    const dialRank = dialMoved ? rank++ : 0;
    delayRank.push(dialRank, dialRank);
  });

  return { key: `${minuteOfDay}:${format}`, minuteOfDay, format, angles, parked, moved, delayRank, animate };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/apps/clock/strokes-geometry.test.ts`
Expected: PASS (all describes green).

- [ ] **Step 5: Commit**

```bash
git add src/apps/clock/strokes-geometry.ts src/apps/clock/strokes-geometry.test.ts
git commit -m "feat(strokes): pure geometry — lattice, digit font, step model (TDD)"
```

---

### Task 2: Schema, registry entries, token, thumb

**Files:**
- Create: `src/shared/schemas/face.strokes.ts`
- Create: `public/strokes-thumb.svg`
- Modify: `src/shared/schema-registry.ts` (imports block + `SCHEMAS` faces section)
- Modify: `src/shared/face-registry.ts` (append descriptor after `daylight`)
- Modify: `src/index.css` (add `--face-ghost` to both theme blocks, after `--face-spent`)

**Interfaces:**
- Consumes: nothing from Task 1.
- Produces: `strokesFaceSchema` / `strokesFaceMeta` / `type StrokesFaceConfig`; registry id `strokes` with `configSchemaId: 'face.strokes'`; CSS token `--face-ghost`.

- [ ] **Step 1: Write `src/shared/schemas/face.strokes.ts`**

```ts
import { z } from 'zod';
import type { FieldMetaMap } from '../types';

export const strokesFaceSchema = z.object({
  format: z.enum(['24', '12']).default('24'),
});

export const strokesFaceMeta: FieldMetaMap = {
  format: {
    description: '24-hour or 12-hour digits; 12-hour parks the leading-zero block',
  },
};

export type StrokesFaceConfig = z.infer<typeof strokesFaceSchema>;
```

- [ ] **Step 2: Register it in `src/shared/schema-registry.ts`** — add to the Faces imports:

```ts
import { strokesFaceSchema, strokesFaceMeta } from './schemas/face.strokes';
```

and to the Faces section of `SCHEMAS` (after `face.daylight`):

```ts
  'face.strokes': { schema: strokesFaceSchema, meta: strokesFaceMeta },
```

- [ ] **Step 3: Append the descriptor in `src/shared/face-registry.ts`** (after the `daylight` entry, keeping the three-faces comment style):

```ts
  // Composed Strokes (2026-08-08 spec). SVG thumb, three-faces precedent.
  {
    id: 'strokes',
    name: 'Composed Strokes',
    preview: '/strokes-thumb.svg',
    category: 'artistic',
    configSchemaId: 'face.strokes',
    slots: [],
  },
```

- [ ] **Step 4: Add the token to `src/index.css`** — in the light block after `--face-spent: #e4e4e1;`:

```css
  --face-ghost: #d9d9d4;
```

and in the dark block after `--face-spent: #111316;`:

```css
  --face-ghost: #2c2f35;
```

- [ ] **Step 5: Create `public/strokes-thumb.svg`** (static mini-render, dark disc, ghost field + accent "1"):

```xml
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">
  <circle cx="50" cy="50" r="49" fill="#0d0d11"/>
  <g stroke-linecap="round">
    <g stroke="#2c2f35" stroke-width="1.6">
      <path d="M28 21 l-4.2 4.2 M50 21 l-4.2 4.2 M72 21 l-4.2 4.2"/>
      <path d="M17 39 l-4.2 4.2 M83 39 l-4.2 4.2"/>
      <path d="M17 61 l-4.2 4.2 M83 61 l-4.2 4.2"/>
      <path d="M28 79 l-4.2 4.2 M50 79 l-4.2 4.2 M72 79 l-4.2 4.2"/>
      <path d="M39 32 l-4.2 4.2 M39 50 l-4.2 4.2 M39 68 l-4.2 4.2"/>
    </g>
    <g stroke="#ff8826" stroke-width="2.6">
      <path d="M61 32 v-7 M61 32 v7"/>
      <path d="M61 50 v-7 M61 50 v7"/>
      <path d="M61 68 v-7"/>
    </g>
  </g>
</svg>
```

- [ ] **Step 6: Run the coherence + full suite, expect ONE deliberate failure**

Run: `npm test`
Expected: `registry-coherence` fails — `strokes` exists in `FACES` but not in `FACE_COMPONENTS` (Task 3 closes it). Every other suite passes. If coherence fails on the schema side instead, the schema-registry entry from Step 2 is wrong — fix before proceeding.

- [ ] **Step 7: Commit**

```bash
git add src/shared/schemas/face.strokes.ts src/shared/schema-registry.ts src/shared/face-registry.ts src/index.css public/strokes-thumb.svg
git commit -m "feat(strokes): face.strokes schema, registry descriptor, --face-ghost token, thumb"
```

---

### Task 3: StrokesClock component + face-components wiring

**Files:**
- Create: `src/apps/clock/StrokesClock.tsx`
- Modify: `src/apps/clock/face-components.ts` (import, `FACE_COMPONENTS`, `SWIPE_CYCLE_ORDER`)

**Interfaces:**
- Consumes: everything Task 1 produces; `strokesFaceSchema` from Task 2; `useClockHands(isActive)` → `{ time: Date }`; `FaceProps` from `./face-components`.
- Produces: default-export `StrokesClock` registered as `strokes`.

- [ ] **Step 1: Write `src/apps/clock/StrokesClock.tsx`**

```tsx
import { useMemo, useState } from 'react';
import { useClockHands } from '../../core/hooks/useClockHands';
import { strokesFaceSchema } from '../../shared/schemas/face.strokes';
import {
  DIAL_R,
  HAND_LEN,
  buildLattice,
  stepModel,
} from './strokes-geometry';
import type { StrokesModel } from './strokes-geometry';
import type { FaceProps } from './face-components';

const EASE = 'cubic-bezier(0.4, 0, 0.2, 1)';

/**
 * Composed Strokes — a full-field lattice of 52 two-hand dials; the centre
 * 4x6 block composes HH/MM digit strokes, everything else parks dim on the
 * south-west diagonal. Perfectly still between minutes; a minute step sweeps
 * only the changed hands clockwise (2.4s, 45ms reading-order stagger).
 *
 * All geometry and angle bookkeeping lives in strokes-geometry.ts; this file
 * only renders a StrokesModel.
 */
export default function StrokesClock({ isActive, faceConfig }: FaceProps) {
  const { time } = useClockHands(isActive);

  const parsed = strokesFaceSchema.safeParse(faceConfig ?? {});
  const { format } = parsed.success ? parsed.data : strokesFaceSchema.parse({});

  const lattice = useMemo(() => buildLattice(), []);

  // Derive-during-render with a key guard (the React "adjusting state during
  // render" pattern): the hook ticks every second, but the model only steps
  // when the minute (or format) changes, so 59 renders in 60 diff to nothing.
  const [model, setModel] = useState<StrokesModel>(() =>
    stepModel(null, lattice, time.getHours(), time.getMinutes(), format),
  );
  const key = `${time.getHours() * 60 + time.getMinutes()}:${format}`;
  if (model.key !== key) {
    setModel(stepModel(model, lattice, time.getHours(), time.getMinutes(), format));
  }

  return (
    <div className="theme-fade flex h-full w-full items-center justify-center bg-(--face-bg)">
      <svg viewBox="0 0 1000 1000" className="h-full w-full max-h-screen max-w-screen">
        {lattice.map((cell, i) => {
          const color = model.parked[i] ? 'var(--face-ghost)' : 'var(--color-accent)';
          return (
            <g key={`${cell.col},${cell.row}`}>
              <circle cx={cell.cx} cy={cell.cy} r={DIAL_R} fill="var(--face-plate)" />
              {([0, 1] as const).map((j) => {
                const idx = 2 * i + j;
                const transition =
                  model.animate && model.moved[idx]
                    ? `transform 2.4s ${EASE} ${Math.min(model.delayRank[idx] * 45, 500)}ms, stroke 2.4s ${EASE}`
                    : 'none';
                return (
                  <g
                    key={j}
                    style={{
                      transform: `translate(${cell.cx}px, ${cell.cy}px) rotate(${model.angles[idx]}deg)`,
                      transition,
                    }}
                  >
                    <line
                      x1="0"
                      y1="0"
                      x2="0"
                      y2={-HAND_LEN}
                      stroke={color}
                      strokeWidth="13"
                      strokeLinecap="round"
                    />
                  </g>
                );
              })}
            </g>
          );
        })}
      </svg>
    </div>
  );
}
```

- [ ] **Step 2: Wire `src/apps/clock/face-components.ts`** — add the import after `DaylightClock`:

```ts
import StrokesClock from './StrokesClock';
```

add to `FACE_COMPONENTS` after `daylight`:

```ts
  strokes: StrokesClock,
```

and append `StrokesClock,` as the last entry of `SWIPE_CYCLE_ORDER`.

- [ ] **Step 3: Full gate**

Run: `npm test && npm run lint && npm run build`
Expected: registry-coherence now green (all three lists agree); zero lint errors (watch the react-hooks Compiler rules — no ref reads in render, guarded render-phase `setModel` only); build completes.

- [ ] **Step 4: Commit**

```bash
git add src/apps/clock/StrokesClock.tsx src/apps/clock/face-components.ts
git commit -m "feat(strokes): Composed Strokes face component + registry wiring"
```

---

### Task 4: In-browser verification

**Files:** none (verification; fixes commit under Task 3's scope)

- [ ] **Step 1:** Start the dev server (`.claude/launch.json` name, port 5180) via the preview tools, not Bash.
- [ ] **Step 2:** Drive the kiosk to the clock app's `strokes` face: in the page console set the face via `window.__nav` / swipe-cycle, or temporarily append `?face` handling — simplest is `window.__nav.getState()` inspection plus vertical-swipe cycling calls; the face is last in `SWIPE_CYCLE_ORDER`.
- [ ] **Step 3:** Assert via `read_page`/screenshot: 52 plates render; core shows the current time as accent strokes; field is ghost-parked at 225°; no console errors.
- [ ] **Step 4:** Trigger a minute rollover (wait for the natural minute change) and confirm changed hands sweep once, clockwise, then stop. Confirm nothing animates while idle (two screenshots 5s apart, identical).
- [ ] **Step 5:** Screenshot both themes (dark + light via theme toggle or `prefers-color-scheme` emulation) for the PR.

## Self-Review

- **Spec coverage:** lattice/core/hands (T1), font + junction convention (T1 test), 12h blank tens (T1), motion contract incl. midnight wrap + snap rules (T1 stepModel + T3 transition wiring), tokens (T2), config (T2), wiring list items 1–6 (T2+T3), testing section (T1), out-of-scope untouched. ✓
- **Placeholder scan:** none. ✓
- **Type consistency:** `StrokesModel` field names match between geometry and component; `HandPair` readonly tuple used in font + composeTargets; `delayRank`/`moved` are 2-per-cell in both producer and consumer. ✓
