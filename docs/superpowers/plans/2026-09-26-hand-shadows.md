# Hand Shadows Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give the five faces with a decided default an optional shadow under their hands (`handShadow: none | cast | soft`), drawn by one shared component so the treatment is one implementation and not five.

**Architecture:** A framework-free fragment in `src/shared/hand-shadow.ts` holds the enum and its admin description; each decided face schema adds `handShadow` with its own default. `src/apps/clock/Hands.tsx` is the one place a hand stroke is drawn: it takes the face's hand list and the mode, and renders the cast copy under each hand (offset on a group outside the rotation) or one soft filter over all of them. Faces hand their hand geometry to it as data. A ninth face role, `--face-shadow`, is black in both palettes and pinned so by the tier gate.

**Tech Stack:** React 19, TypeScript (`verbatimModuleSyntax`, `erasableSyntaxOnly`), zod 4, Vitest + jsdom + Testing Library, Tailwind v4 arbitrary CSS-variable utilities, the repo's own gates (`./scripts/gates.sh`).

**Spec:** `docs/agent-log.md`, entry "2026-09-09 · hand shadows: direction approved, drawn in Figma, nothing built". Drawings: Figma, Clock Design WIP, page "New Drawings", section `Sheet 03 - hand shadows`, node 705:4080.

## Global Constraints

- Enum per face, not a boolean: `none | cast | soft`.
- `cast`: offset duplicate geometry, x +8, y +10 in the 1000-unit face space, black at alpha 0.32, no filter.
- `soft`: `feDropShadow` dx 5, dy 7, stdDeviation 9, alpha 0.38. Opt-in, fastclock only.
- The offset is applied OUTSIDE the hand rotation. The light stays fixed while the hand turns.
- `--face-shadow` stays black in both palettes. No light lift at night.
- Defaults: Floral, Productivity, Complications Light `cast`; Analog, Complications Dark `none`. The other eight faces get no key (a default is a decision, and theirs is not made).
- `useClockHands` is the only source of hand angles; no `setInterval` in `src/apps/clock/` (ESLint, `KIO-3`).
- A schema default must match what the face already draws where the decision is `none`; where it is `cast`, the glass changes by design and the log says so.
- Adding a defaulted field is a minor schema change: `npm run snapshot:schemas` regenerates the snapshot; `FLEET_SCHEMA_VERSION` does not move.
- `src/shared/part-contracts.test.ts` requires every schema key to carry an `options` intent in the face's `.meta.json`; `npm run build:index` after editing a meta.
- Analog's numbers stay in its meta `spec`; nothing hand-related is hardcoded back into `AnalogClock.tsx`.
- No em dashes in prose or comments.

---

### Task 1: The `--face-shadow` role, pinned black in both palettes

**Files:**
- Modify: `src/styles/tokens.css` (both tier 2 blocks, after `--face-ghost`)
- Modify: `src/shared/token-tiers.test.ts` (`FACE_BEFORE`)

**Interfaces:**
- Produces: the CSS custom property `--face-shadow`, resolving to `#000000` in `:root, html.light` and in `html.dark`.

- [ ] **Step 1: Write the failing test.** In `src/shared/token-tiers.test.ts`, add the ninth role to both maps and reword the comment above them:

```ts
// The eight face roles as src/index.css declared them before the token layer
// (commit prior to this work), plus --face-shadow, added 2026-09-26 for the
// hand-shadow option and pinned black in BOTH modes on purpose: a lighter
// value at night would be a glow, a different physical claim. A face that
// resolves to anything else is a pixel change on thirteen faces.
const FACE_BEFORE = {
  light: {
    // ...existing eight...
    '--face-shadow': '#000000',
  },
  dark: {
    // ...existing eight...
    '--face-shadow': '#000000',
  },
} as const;
```

- [ ] **Step 2: Run it to see it fail.** `npx vitest run src/shared/token-tiers.test.ts` fails twice: `light: --face-shadow still resolves to #000000` gets `(undeclared)`, and the dark twin likewise.

- [ ] **Step 3: Declare the role.** In `src/styles/tokens.css`, in `:root, html.light` after `--face-ghost`:

```css
  /* The hand shadow (2026-09-26). Black in both modes on purpose: a
     lighter value at night is a glow, and black-dial faces default the
     option off instead. Read by src/apps/clock/Hands.tsx. */
  --face-shadow: var(--stone-1000);
```

and in `html.dark` after `--face-ghost`:

```css
  --face-shadow: var(--stone-1000);
```

- [ ] **Step 4: Run the tier, contrast and liveness gates.** `npx vitest run src/shared/token-tiers.test.ts src/shared/token-contrast.test.ts src/shared/token-liveness.test.ts`. Tiers passes. Contrast passes: the name carries no `ink`, so no pair is required (the `--fill-knob` precedent). Liveness FAILS: `--face-shadow` is declared and nothing reads it yet. That is correct and Task 3 closes it; do not ledger it.

- [ ] **Step 5: Commit** (liveness red is expected until Task 3; the commit message says so).

```bash
git add src/styles/tokens.css src/shared/token-tiers.test.ts
git commit -m "feat(tokens): --face-shadow, the ninth face role, black in both modes

Liveness reads red until Hands.tsx reads it two commits on."
```

---

### Task 2: The option, its defaults, and the contract that a default is a decision

**Files:**
- Create: `src/shared/hand-shadow.ts`
- Create: `src/shared/hand-shadow.test.ts`
- Modify: `src/shared/schemas/face.floral.ts`, `face.productivity.ts`, `face.complications-light.ts`, `face.analog.ts`, `face.complications-dark.ts`
- Modify: `src/apps/clock/FloralClock.meta.json`, `ProductivityClock.meta.json`, `ComplicationsLight.meta.json`, `AnalogClock.meta.json`, `ComplicationsDark.meta.json`
- Regenerate: `src/shared/schemas.snapshot.json`, `index/parts.toon`, `docs/analysis/declared-vs-read.md`, `docs/health.md`

**Interfaces:**
- Produces: `HAND_SHADOW_MODES: readonly ['none','cast','soft']`, `type HandShadowMode`, `handShadowSchema: z.ZodEnum`, `handShadowMeta: FieldMeta` from `src/shared/hand-shadow.ts`. Each decided face schema's parsed output gains `handShadow: HandShadowMode`.

- [ ] **Step 1: Write the failing test.** `src/shared/hand-shadow.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { SCHEMAS } from './schema-registry';
import { HAND_SHADOW_MODES, type HandShadowMode } from './hand-shadow';

// The per-face default is a design decision (agent log, 2026-09-09), so it
// is data here, and a face gains the key only by landing a row. The eight
// faces not listed have no decided default and carry no key: shipping
// `none` on them would be a decision made by omission.
const DECIDED: Record<string, HandShadowMode> = {
  floral: 'cast',
  productivity: 'cast',
  'complications-light': 'cast',
  analog: 'none',
  'complications-dark': 'none',
};

const faceIds = Object.keys(SCHEMAS)
  .filter((id) => id.startsWith('face.'))
  .map((id) => id.slice('face.'.length));

describe('hand shadow option', () => {
  it('is the three-way enum the decision named', () => {
    expect(HAND_SHADOW_MODES).toEqual(['none', 'cast', 'soft']);
  });

  it('every decided face carries handShadow at its decided default, accepts every mode, and describes it for the admin', () => {
    for (const [id, mode] of Object.entries(DECIDED)) {
      const entry = SCHEMAS[`face.${id}`];
      expect(entry, `face.${id} is not registered`).toBeDefined();
      const parsed = entry.schema.parse({}) as Record<string, unknown>;
      expect(parsed.handShadow, `face.${id}: default`).toBe(mode);
      for (const m of HAND_SHADOW_MODES) {
        expect(entry.schema.safeParse({ handShadow: m }).success, `face.${id} rejects ${m}`).toBe(true);
      }
      expect(entry.schema.safeParse({ handShadow: 'glow' }).success, `face.${id} accepts an unknown mode`).toBe(false);
      expect(entry.meta.handShadow?.description, `face.${id}: meta lacks a description`).toBeTruthy();
    }
  });

  it('no other face carries handShadow: a default is a decision, not a fallthrough', () => {
    for (const id of faceIds) {
      if (id in DECIDED) continue;
      const parsed = SCHEMAS[`face.${id}`].schema.parse({}) as Record<string, unknown>;
      expect('handShadow' in parsed, `face.${id} carries handShadow without a decided default; add its row here with the decision`).toBe(false);
    }
  });
});
```

- [ ] **Step 2: Run it to see it fail.** `npx vitest run src/shared/hand-shadow.test.ts`: fails to import `./hand-shadow`.

- [ ] **Step 3: The fragment.** `src/shared/hand-shadow.ts`:

```ts
import { z } from 'zod';
import type { FieldMeta } from './types';

// The hand-shadow option a face may carry, decided 2026-09-09 (agent log,
// "hand shadows"). An enum and not a boolean, because the fleet spans one
// Pi 5 and three Pi 4s and the two treatments cost differently:
//   none  draws nothing.
//   cast  is an offset copy of each hand, flat black at alpha 0.32. One
//         extra element per hand, nothing per frame. Every device.
//   soft  is a blurred drop shadow that re-rasterizes every frame while
//         the second hand sweeps. Opt-in, fastclock only.
// A face gains the key only with a decided default; the decisions are the
// table in src/shared/hand-shadow.test.ts. Drawn by src/apps/clock/Hands.tsx.
export const HAND_SHADOW_MODES = ['none', 'cast', 'soft'] as const;
export type HandShadowMode = (typeof HAND_SHADOW_MODES)[number];
export const handShadowSchema = z.enum(HAND_SHADOW_MODES);

export const handShadowMeta: FieldMeta = {
  description:
    'Shadow the hands cast on the dial. "cast" is a flat offset copy and costs nothing per frame. "soft" is a blurred drop shadow that re-renders every frame, so it belongs on the Pi 5 only.',
};
```

- [ ] **Step 4: The five schemas.** Each adds one import, one field, one meta row. Floral (`cast`):

```ts
import { handShadowSchema, handShadowMeta } from '../hand-shadow';

export const floralFaceSchema = z.object({
  accent: z.string().default('#fbbf24'),
  // cast by default: white hands over a bright field (agent log 2026-09-09).
  handShadow: handShadowSchema.default('cast'),
});

export const floralFaceMeta: FieldMetaMap = {
  accent: { format: 'color', description: 'Hand color over the artwork' },
  handShadow: handShadowMeta,
};
```

Productivity: same shape, `.default('cast')`, comment "cast by default: the hands cross the rim segments". Complications Light: `.default('cast')`, comment "cast by default, replacing the per-frame blurred filter the hands carried". Analog: `.default('none')`, comment "none by default: a black dial, and the LVGL twin draws no shadow". Complications Dark: `.default('none')`, comment "none by default: black on a black dial contributes nothing".

- [ ] **Step 5: Run the test to see it pass.** `npx vitest run src/shared/hand-shadow.test.ts` green. Then `npx vitest run src/shared/part-contracts.test.ts` FAILS: "options differ from face schema keys" for the five faces.

- [ ] **Step 6: The five metas.** Append to each `options` array (intent is prose of at least 20 characters, no em dashes):

- `FloralClock.meta.json`: `{ "key": "handShadow", "intent": "cast by default: white hands over a bright field need the shadow to read; soft only on the Pi 5, where a blurred region per frame is affordable." }`
- `ProductivityClock.meta.json`: `{ "key": "handShadow", "intent": "cast by default so the hands lift off the rim segments they cross; soft only on the Pi 5." }`
- `ComplicationsLight.meta.json`: `{ "key": "handShadow", "intent": "cast by default, replacing the blurred filter the hands carried per frame; soft brings a blur back, on the Pi 5 only." }`
- `AnalogClock.meta.json`: `{ "key": "handShadow", "intent": "none by default: a black dial gives a shadow nothing to fall on, and the LVGL twin cannot draw one, so cast or soft here is React-only." }` and append to `antiPatterns`: `{ "rule": "Do not default handShadow to cast or soft", "why": "clock_face.c draws no shadow; a default other than none is React-only drift the parity ledger cannot see" }`
- `ComplicationsDark.meta.json`: `{ "key": "handShadow", "intent": "none by default: black on a black dial contributes nothing, and a lighter lift would be a glow, which reads cheap on an LCD." }`

- [ ] **Step 7: Regenerate what the metas and schemas feed.**

```bash
npm run snapshot:schemas          # minor: five defaulted enum fields added
npm run build:index               # index/parts.toon
npm run analyze -- --write        # docs/analysis/declared-vs-read.md (handShadow is unread until Task 4)
npm run report                    # docs/health.md
npx vitest run src/shared
```

Expected: `snapshot:schemas` classifies the diff minor and writes. `src/shared` tests green except `token-liveness` (Task 1's known red) and, possibly, `scripts/lib/analyze.test.ts` if it pins the report text, which the `--write` run refreshes.

- [ ] **Step 8: Commit.**

```bash
git add src/shared/hand-shadow.ts src/shared/hand-shadow.test.ts src/shared/schemas/face.*.ts src/apps/clock/*.meta.json src/shared/schemas.snapshot.json index/parts.toon docs/analysis/declared-vs-read.md docs/health.md
git commit -m "feat(faces): the handShadow option on the five faces with a decided default

none | cast | soft. Floral, Productivity and Complications Light default cast;
Analog and Complications Dark default none. A face gains the key only with a
row in hand-shadow.test.ts, so the other eight ship nothing rather than an
undecided none."
```

---

### Task 3: `Hands`, the one place a hand is drawn

**Files:**
- Create: `src/apps/clock/Hands.tsx`
- Create: `src/apps/clock/Hands.test.tsx`

**Interfaces:**
- Consumes: `HandShadowMode` from Task 2.
- Produces: `interface HandSpec { deg; tip; tail?; width; stroke; core?: { width; stroke }; transition? }`, `function Hands({ id, shadow, hands }: { id: string; shadow: HandShadowMode; hands: HandSpec[] })`, constants `CAST = { dx: 8, dy: 10, alpha: 0.32 }`, `SOFT = { dx: 5, dy: 7, blur: 9, alpha: 0.38 }`, `SECOND_HAND_SPRING`.
- DOM contract the faces' tests rely on: each cast shadow is a `<g data-hand-shadow="cast" transform="translate(8 10)" opacity="0.32">` holding one `<line class="stroke-(--face-shadow)">`, immediately before the hand it shadows; soft is one `<g data-hand-shadow="soft" filter="url(#<id>-hand-shadow)">` around every hand plus a `<filter>` in `<defs>`.

- [ ] **Step 1: Write the failing test.** `src/apps/clock/Hands.test.tsx`:

```tsx
// @vitest-environment jsdom
import { describe, it, expect, afterEach } from 'vitest';
import { render, cleanup } from '@testing-library/react';
import { Hands, CAST, SOFT, type HandSpec } from './Hands';

afterEach(cleanup);

const HANDS: HandSpec[] = [
  { deg: 90, tip: 235, tail: 20, width: 24, stroke: 'white' },
  { deg: 180, tip: 335, tail: 25, width: 15, stroke: 'white' },
  { deg: 270, tip: 355, tail: 65, width: 5, stroke: 'gold', transition: 'transform 0.2s' },
];

function draw(shadow: 'none' | 'cast' | 'soft', hands: HandSpec[] = HANDS) {
  const { container } = render(
    <svg viewBox="0 0 1000 1000">
      <Hands id="t" shadow={shadow} hands={hands} />
    </svg>,
  );
  return container.querySelector('svg')!;
}

describe('Hands', () => {
  it('none: one line per hand, rotated about the centre, and nothing else', () => {
    const svg = draw('none');
    const lines = [...svg.querySelectorAll('line')];
    expect(lines).toHaveLength(3);
    expect(svg.querySelectorAll('[data-hand-shadow]')).toHaveLength(0);
    expect(lines[0].getAttribute('x1')).toBe('500');
    expect(lines[0].getAttribute('y1')).toBe('520'); // centre + tail
    expect(lines[0].getAttribute('y2')).toBe('265'); // centre - tip
    expect(lines[0].getAttribute('stroke-width')).toBe('24');
    expect(lines[0].style.transform).toBe('rotate(90deg)');
    expect(lines[0].style.transformOrigin).toBe('500px 500px');
    expect(lines[2].style.transition).toBe('transform 0.2s');
  });

  it('cast: a translated copy under each hand, offset outside the rotation, interleaved so a shadow falls on the hands beneath', () => {
    const svg = draw('cast');
    const groups = [...svg.querySelectorAll('[data-hand-shadow="cast"]')];
    expect(groups).toHaveLength(3);
    const lines = [...svg.querySelectorAll('line')];
    expect(lines).toHaveLength(6);
    groups.forEach((g, i) => {
      expect(g.getAttribute('transform')).toBe(`translate(${CAST.dx} ${CAST.dy})`);
      expect(g.getAttribute('opacity')).toBe(String(CAST.alpha));
      const shadow = g.querySelector('line')!;
      const hand = lines[2 * i + 1];
      expect(lines[2 * i], 'shadow precedes its hand').toBe(shadow);
      expect(shadow.getAttribute('class')).toBe('stroke-(--face-shadow)');
      expect(shadow.hasAttribute('stroke')).toBe(false);
      for (const a of ['x1', 'y1', 'x2', 'y2', 'stroke-width']) {
        expect(shadow.getAttribute(a), a).toBe(hand.getAttribute(a));
      }
      expect(shadow.style.transform).toBe(hand.style.transform);
      expect(shadow.style.transform).not.toContain('translate');
      expect(shadow.style.transition).toBe(hand.style.transition);
    });
  });

  it('soft: one filter over every hand, on a fixed full-face region, with the decided numbers', () => {
    const svg = draw('soft');
    expect(svg.querySelectorAll('[data-hand-shadow="cast"]')).toHaveLength(0);
    const group = svg.querySelector('[data-hand-shadow="soft"]')!;
    expect(group.getAttribute('filter')).toBe('url(#t-hand-shadow)');
    expect(group.querySelectorAll('line')).toHaveLength(3);
    expect(svg.querySelectorAll('line')).toHaveLength(3);
    const filter = svg.querySelector('filter#t-hand-shadow')!;
    expect(filter.getAttribute('filterUnits')).toBe('userSpaceOnUse');
    expect([filter.getAttribute('x'), filter.getAttribute('y'), filter.getAttribute('width'), filter.getAttribute('height')]).toEqual(['0', '0', '1000', '1000']);
    const drop = filter.querySelector('feDropShadow')!;
    expect(drop.getAttribute('dx')).toBe(String(SOFT.dx));
    expect(drop.getAttribute('dy')).toBe(String(SOFT.dy));
    expect(drop.getAttribute('stdDeviation')).toBe(String(SOFT.blur));
    expect(drop.getAttribute('flood-opacity')).toBe(String(SOFT.alpha));
    expect(drop.getAttribute('style')).toContain('var(--face-shadow)');
  });

  it('a bordered hand draws its core on top and casts one shadow, from the outer stroke', () => {
    const bordered: HandSpec[] = [{ deg: 0, tip: 190, tail: 35, width: 44, stroke: 'white', core: { width: 32, stroke: '#111' } }];
    const plain = draw('none', bordered);
    const [outer, core] = [...plain.querySelectorAll('line')];
    expect(outer.getAttribute('stroke-width')).toBe('44');
    expect(core.getAttribute('stroke-width')).toBe('32');
    expect(core.getAttribute('stroke')).toBe('#111');
    cleanup();
    const cast = draw('cast', bordered);
    const shadows = cast.querySelectorAll('[data-hand-shadow="cast"] line');
    expect(shadows).toHaveLength(1);
    expect(shadows[0].getAttribute('stroke-width')).toBe('44');
    expect(cast.querySelectorAll('line')).toHaveLength(3);
  });

  it('the numbers are the decision', () => {
    expect(CAST).toEqual({ dx: 8, dy: 10, alpha: 0.32 });
    expect(SOFT).toEqual({ dx: 5, dy: 7, blur: 9, alpha: 0.38 });
  });
});
```

- [ ] **Step 2: Run it to see it fail.** `npx vitest run src/apps/clock/Hands.test.tsx`: cannot resolve `./Hands`.

- [ ] **Step 3: The component.** `src/apps/clock/Hands.tsx`:

```tsx
import type { CSSProperties } from 'react';
import type { HandShadowMode } from '../../shared/hand-shadow';

// Every face draws its hands in the same 1000-unit space about the same
// centre, as a vertical stroke rotated by useClockHands' angle. This is the
// one place that stroke is drawn, so the shadow option (agent log
// 2026-09-09) is one implementation and not five.
const C = 500;

// The two treatments' numbers, from the 2026-09-09 decision (Figma, Clock
// Design WIP, Sheet 03, node 705:4080). Offsets are in face units.
export const CAST = { dx: 8, dy: 10, alpha: 0.32 } as const;
export const SOFT = { dx: 5, dy: 7, blur: 9, alpha: 0.38 } as const;

/** The second hand's spring, shared so a hand and its shadow move as one. */
export const SECOND_HAND_SPRING = 'transform 0.2s cubic-bezier(0.4, 2.08, 0.55, 0.44)';

export interface HandSpec {
  /** Rotation in degrees from 12, from useClockHands. */
  deg: number;
  /** Length from the centre to the tip, in face units. */
  tip: number;
  /** Length past the centre on the far side. */
  tail?: number;
  width: number;
  stroke: string;
  /** A narrower stroke drawn on top: a bordered hand. The shadow follows the outer stroke only. */
  core?: { width: number; stroke: string };
  /** CSS transition for the rotation; the shadow gets the same one. */
  transition?: string;
}

interface HandsProps {
  /** Unique within the face's SVG; names the soft filter. */
  id: string;
  shadow: HandShadowMode;
  /** Drawn in order, the first at the bottom. */
  hands: HandSpec[];
}

function rotation(deg: number, transition?: string): CSSProperties {
  return { transform: `rotate(${deg}deg)`, transformOrigin: `${C}px ${C}px`, transition };
}

function Stroke({ hand, width, stroke, className }: { hand: HandSpec; width: number; stroke?: string; className?: string }) {
  return (
    <line
      x1={C}
      y1={C + (hand.tail ?? 0)}
      x2={C}
      y2={C - hand.tip}
      stroke={stroke}
      strokeWidth={width}
      strokeLinecap="round"
      className={className}
      style={rotation(hand.deg, hand.transition)}
    />
  );
}

function Hand({ hand }: { hand: HandSpec }) {
  return (
    <>
      <Stroke hand={hand} width={hand.width} stroke={hand.stroke} />
      {hand.core && <Stroke hand={hand} width={hand.core.width} stroke={hand.core.stroke} />}
    </>
  );
}

export function Hands({ id, shadow, hands }: HandsProps) {
  if (shadow === 'cast') {
    // The offset sits on a group OUTSIDE the rotation, so the light stays
    // put while the hand turns. Interleaved with the hands so a hand's
    // shadow falls on the hands beneath it, not only on the dial.
    return (
      <>
        {hands.map((hand, i) => (
          <g key={i}>
            <g transform={`translate(${CAST.dx} ${CAST.dy})`} opacity={CAST.alpha} data-hand-shadow="cast">
              <Stroke hand={hand} width={hand.width} className="stroke-(--face-shadow)" />
            </g>
            <Hand hand={hand} />
          </g>
        ))}
      </>
    );
  }
  if (shadow === 'soft') {
    // One filter over all the hands, on a fixed full-face region. The
    // default region is a fraction of the element's own bounding box,
    // which for a thin hand at 3 o'clock is a few units tall and clips
    // the blur. One region rather than one per hand, because the whole
    // region re-rasterizes every frame the second hand moves; that cost
    // is why this mode is opt-in.
    const filterId = `${id}-hand-shadow`;
    return (
      <>
        <defs>
          <filter id={filterId} filterUnits="userSpaceOnUse" x={0} y={0} width={2 * C} height={2 * C}>
            <feDropShadow
              dx={SOFT.dx}
              dy={SOFT.dy}
              stdDeviation={SOFT.blur}
              floodOpacity={SOFT.alpha}
              style={{ floodColor: 'var(--face-shadow)' }}
            />
          </filter>
        </defs>
        <g filter={`url(#${filterId})`} data-hand-shadow="soft">
          {hands.map((hand, i) => (
            <Hand key={i} hand={hand} />
          ))}
        </g>
      </>
    );
  }
  return (
    <>
      {hands.map((hand, i) => (
        <Hand key={i} hand={hand} />
      ))}
    </>
  );
}
```

- [ ] **Step 4: Run the test and the liveness gate.** `npx vitest run src/apps/clock/Hands.test.tsx src/shared/token-liveness.test.ts`: both green (the class string reads `--face-shadow`, which closes Task 1's red). Then `npm run lint`.

- [ ] **Step 5: Commit.**

```bash
git add src/apps/clock/Hands.tsx src/apps/clock/Hands.test.tsx
git commit -m "feat(faces): Hands, the one place a hand and its shadow are drawn

cast is a translated copy under each hand, the offset on a group outside the
rotation; soft is one feDropShadow over all hands on a fixed full-face region,
because the default region clips a thin hand's blur at 3 o'clock."
```

---

### Task 4: The five faces hand their geometry to `Hands`

**Files:**
- Modify: `src/apps/clock/FloralClock.tsx:71-94`, `ProductivityClock.tsx:91-120`, `ComplicationsLight.tsx:46-58,127-141`, `ComplicationsDark.tsx:45-48,116-127`, `AnalogClock.tsx:86-97,110-125`
- Create: `src/apps/clock/hand-shadow-wiring.test.tsx`

**Interfaces:**
- Consumes: `Hands`, `HandSpec`, `SECOND_HAND_SPRING` from Task 3; each face's `handShadow` from Task 2.

Every line y-value converts as `tail = y1 - 500`, `tip = 500 - y2`. The table, read straight off the current TSX:

| Face | Hand | y1 | y2 | tail | tip | width | stroke |
|---|---|---|---|---|---|---|---|
| Floral | hour | 520 | 265 | 20 | 235 | 24 | white |
| Floral | minute | 525 | 165 | 25 | 335 | 15 | white |
| Floral | second | 565 | 145 | 65 | 355 | 5 | accent |
| Productivity | hour | 500 | 260 | 0 | 240 | 22 | white |
| Productivity | minute | 500 | 175 | 0 | 325 | 16 | white |
| Productivity | second | 560 | 180 | 60 | 320 | 4 | accent |
| Compl. Light | hour | 535 | 310 | 35 | 190 | 44, core 32 | white, core #111 |
| Compl. Light | minute | 530 | 182 | 30 | 318 | 34, core 24 | white, core #111 |
| Compl. Light | second | 572 | 152 | 72 | 348 | 7 | #f59e0b |
| Compl. Dark | hour | 535 | 310 | 35 | 190 | 32 | #ccc |
| Compl. Dark | minute | 530 | 182 | 30 | 318 | 22 | #ddd |
| Compl. Dark | second | 572 | 152 | 72 | 348 | 7 | #7c3aed |
| Analog | all | from `spec.hands` | | | | | |

- [ ] **Step 1: Write the failing test.** `src/apps/clock/hand-shadow-wiring.test.tsx`:

```tsx
// @vitest-environment jsdom
import { describe, it, expect, afterEach } from 'vitest';
import { render, cleanup } from '@testing-library/react';
import type { FaceComponent } from './face-components';
import FloralClock from './FloralClock';
import ProductivityClock from './ProductivityClock';
import ComplicationsLight from './ComplicationsLight';
import ComplicationsDark from './ComplicationsDark';
import AnalogClock from './AnalogClock';

afterEach(cleanup);

// isActive false: no timer starts, the hands render once at mount time.
function shadows(Face: FaceComponent, faceConfig?: Record<string, unknown>) {
  const { container } = render(<Face isActive={false} faceConfig={faceConfig} />);
  return {
    cast: container.querySelectorAll('[data-hand-shadow="cast"]').length,
    soft: container.querySelectorAll('[data-hand-shadow="soft"]').length,
    lines: container.querySelectorAll('line').length,
    container,
  };
}

const CAST_BY_DEFAULT: Array<[string, FaceComponent]> = [
  ['floral', FloralClock],
  ['productivity', ProductivityClock],
  ['complications-light', ComplicationsLight],
];
const NONE_BY_DEFAULT: Array<[string, FaceComponent]> = [
  ['analog', AnalogClock],
  ['complications-dark', ComplicationsDark],
];

describe('hand shadow wiring', () => {
  for (const [id, Face] of CAST_BY_DEFAULT) {
    it(`${id}: three cast shadows unconfigured, none when told none, one soft filter when told soft`, () => {
      expect(shadows(Face).cast).toBe(3);
      cleanup();
      expect(shadows(Face, { handShadow: 'none' }).cast).toBe(0);
      cleanup();
      const soft = shadows(Face, { handShadow: 'soft' });
      expect(soft.cast).toBe(0);
      expect(soft.soft).toBe(1);
    });
  }

  for (const [id, Face] of NONE_BY_DEFAULT) {
    it(`${id}: no shadow unconfigured, three cast when told cast`, () => {
      const rest = shadows(Face);
      expect(rest.cast + rest.soft).toBe(0);
      cleanup();
      expect(shadows(Face, { handShadow: 'cast' }).cast).toBe(3);
    });
  }

  it('productivity and analog cast two shadows when the second hand is off', () => {
    expect(shadows(ProductivityClock, { showSeconds: false }).cast).toBe(2);
    cleanup();
    expect(shadows(AnalogClock, { showSeconds: false, handShadow: 'cast' }).cast).toBe(2);
  });

  it('complications light no longer carries its own per-line blur', () => {
    const { container } = shadows(ComplicationsLight);
    expect(container.querySelector('filter#cl-shadow')).toBeNull();
    expect(container.querySelectorAll('line[filter]')).toHaveLength(0);
  });

  it('an invalid saved value falls back to the default, not to a crash', () => {
    expect(shadows(FloralClock, { handShadow: 'glow' }).cast).toBe(3);
  });
});
```

- [ ] **Step 2: Run it to see it fail.** `npx vitest run src/apps/clock/hand-shadow-wiring.test.tsx`: every case fails on `cast` count 0.

- [ ] **Step 3: Floral.** Replace the three hand `<line>`s (lines 71 to 92) with:

```tsx
        <Hands
          id="floral"
          shadow={handShadow}
          hands={[
            { deg: hourDeg, tip: 235, tail: 20, width: 24, stroke: 'white' },
            { deg: minuteDeg, tip: 335, tail: 25, width: 15, stroke: 'white' },
            { deg: secondDeg, tip: 355, tail: 65, width: 5, stroke: accent, transition: SECOND_HAND_SPRING },
          ]}
        />
```

with `const { accent, handShadow } = parsed.success ? parsed.data : floralFaceSchema.parse({});` and `import { Hands, SECOND_HAND_SPRING } from './Hands';`. The two pip circles stay after it.

- [ ] **Step 4: Productivity.** `const { accent, showSeconds, handShadow } = ...`. Build the list before `return`:

```tsx
  const hands: HandSpec[] = [
    { deg: hourDeg, tip: 240, width: 22, stroke: 'white' },
    { deg: minuteDeg, tip: 325, width: 16, stroke: 'white' },
  ];
  if (showSeconds) {
    hands.push({ deg: secondDeg, tip: 320, tail: 60, width: 4, stroke: accent, transition: SECOND_HAND_SPRING });
  }
```

Replace lines 91 to 116 with `<Hands id="productivity" shadow={handShadow} hands={hands} />`. Import `{ Hands, SECOND_HAND_SPRING, type HandSpec } from './Hands'`.

- [ ] **Step 5: Complications Light.** Delete the `<defs>` with `cl-shadow` (lines 54 to 58) and the `style` helper (lines 46 to 49). `const { accent, handShadow } = ...`. Replace lines 127 to 141 with:

```tsx
        <Hands
          id="complications-light"
          shadow={handShadow}
          hands={[
            { deg: hourDeg, tip: 190, tail: 35, width: 44, stroke: 'white', core: { width: 32, stroke: '#111' } },
            { deg: minuteDeg, tip: 318, tail: 30, width: 34, stroke: 'white', core: { width: 24, stroke: '#111' } },
            { deg: secondDeg, tip: 348, tail: 72, width: 7, stroke: '#f59e0b', transition: SECOND_HAND_SPRING },
          ]}
        />
```

- [ ] **Step 6: Complications Dark.** Delete the `style` helper (lines 45 to 48). `const { accent, handShadow } = ...`. Replace lines 116 to 127 with:

```tsx
        <Hands
          id="complications-dark"
          shadow={handShadow}
          hands={[
            { deg: hourDeg, tip: 190, tail: 35, width: 32, stroke: '#ccc' },
            { deg: minuteDeg, tip: 318, tail: 30, width: 22, stroke: '#ddd' },
            { deg: secondDeg, tip: 348, tail: 72, width: 7, stroke: '#7c3aed', transition: SECOND_HAND_SPRING },
          ]}
        />
```

The hub circle before the hands and the pip after them stay.

- [ ] **Step 7: Analog.** Delete the `hand` helper (lines 86 to 97). `const { accent, numeralStyle, showSeconds, handShadow } = ...`. Build the list after `background`:

```tsx
  const hands: HandSpec[] = [
    { deg: hourDeg, tip: spec.hands.hour.tip, width: spec.hands.hour.width, stroke: resolveSpecColor(spec.hands.hour.color ?? spec.face.ink, colors) },
    { deg: minuteDeg, tip: spec.hands.minute.tip, width: spec.hands.minute.width, stroke: resolveSpecColor(spec.hands.minute.color ?? spec.face.ink, colors) },
  ];
  if (showSeconds) {
    hands.push({
      deg: secondDeg,
      tip: secondSpec.tip,
      tail: secondSpec.tail ?? 0,
      width: secondSpec.width,
      stroke: resolveSpecColor(secondSpec.color ?? spec.face.ink, colors),
      transition: SECOND_HAND_SPRING,
    });
  }
```

Replace lines 110 to 125 with `<Hands id="analog" shadow={handShadow} hands={hands} />`.

- [ ] **Step 8: Run the wiring test, the contracts, the analysis and the whole suite.**

```bash
npx vitest run src/apps/clock src/shared/part-contracts.test.ts src/shared/lvgl-parity.test.ts
npm run analyze -- --write        # handShadow now read by all five
npm run report
npm run lint
npm test
```

Expected: green. `part-contracts` still finds Analog's spec numbers only in the meta. `lvgl-parity` is unchanged: the C constants and the Analog spec did not move.

- [ ] **Step 9: Commit.**

```bash
git add src/apps/clock docs/analysis/declared-vs-read.md docs/health.md
git commit -m "feat(faces): Floral, Productivity, Complications Light cast hand shadows by default

Analog and Complications Dark carry the option at none. Complications Light
loses its per-line feDropShadow: it was clipped by the default filter region
whenever a hand lay near 3 or 9, and it was a blur per frame on a Pi 4."
```

---

### Task 5: Gates, the rendered pass, the device, the log

**Files:**
- Modify: `docs/agent-log.md` (new entry at the top)

- [ ] **Step 1: The local CI mirror.** `./scripts/gates.sh` green end to end (lint, check:tokens, test, build). `npm run check:rules` prints FCE-1 unchecked as always; no new hits.

- [ ] **Step 2: unslop Phase 2 on the changed files.** Mechanical: the gates above own the greps. Rendered: front the preview tab, size it 1080x1080, and check Floral, Productivity and Complications Light at rest in both palettes (`html.dark` on and off): one accent per face still, the shadow is black in both, nothing animates but the second hand. Check `soft` on one face by saving `handShadow: 'soft'` through the admin form or the dev config, and confirm the blur is not clipped with the minute hand near 3 o'clock. Screenshot each.

- [ ] **Step 3: Deploy the branch build to fastclock** (the designated test device; the deploy guard needs `DEPLOY_ANYWAY=1` for a branch):

```bash
DEPLOY_ANYWAY=1 bash scripts/deploy.sh nickv2026@fastclock
```

Then confirm `/api/health` on 192.168.4.30:3000 reports the branch's commit, restart Chromium (`pkill -TERM chromium` over ssh), and read the DOM for `[data-hand-shadow="cast"]` on the Floral face.

- [ ] **Step 4: Agent log.** A new entry at the top of `docs/agent-log.md`: what changed (files), what was verified and how, the decisions taken here (one soft filter over all hands rather than one per hand; Complications Light's blur replaced; Analog carries the option at `none` with a parity anti-pattern), and what stays open (the eight undecided faces, `soft` on a Pi 4, whether Analog should carry the option at all, the C twin for `cast`).

- [ ] **Step 5: Commit and push the branch as an off-machine backup.** No PR unless Nick asks.

```bash
git add docs/agent-log.md
git commit -m "docs: agent-log entry for the hand shadows"
git push -u origin claude/hand-shadows
```

---

## Self-review

- Spec coverage: enum (T2), cast numbers and outside-rotation offset (T3), soft numbers (T3), token black in both modes (T1), five defaults and no key on the other eight (T2), snapshot regeneration (T2), meta intents (T2), Analog and LVGL noted (T2 anti-pattern, T5 log). Minimalismo's missing schema is out of scope, as the spec left it.
- Placeholders: none; every code step is complete.
- Names: `HandShadowMode`, `handShadowSchema`, `handShadowMeta`, `HAND_SHADOW_MODES` (T2) match T3 and T4; `Hands`, `HandSpec`, `CAST`, `SOFT`, `SECOND_HAND_SPRING` (T3) match T4; `data-hand-shadow` values `cast` and `soft` match between T3's test and T4's.
