# Countdown App Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship the Countdown kiosk app (days to a date, today, days since) plus the admin's `format: 'date'` field.

**Architecture:** A pure date module (`countdown-state.ts`) turns `(today, config)` into a view model; a pure copy module turns the view model into strings; a thin React component renders them on the face palette with an optional SVG progress ring and re-renders once at local midnight while active. The admin gains one field type in its generic schema form.

**Tech Stack:** React 19, TypeScript (`verbatimModuleSyntax`, `erasableSyntaxOnly`, no enums), zod, Tailwind v4, Vitest 4 + @testing-library/react (jsdom opt-in per file).

**Spec:** `docs/superpowers/specs/2026-10-01-countdown-app-design.md` (read it before starting; board draft: Designs page section `Countdown` `177:1011`).

## Global Constraints

- Checkout path contains spaces (`ClaudeCode Projects`): quote every shell path.
- Worktrees need `npm ci` before tests or build.
- Type sizes: only `text-[17vmin]` (number), `text-[2.6vmin]` (label), `text-[2.2vmin]` (caption). No other font size, no style-object `fontSize`.
- Colours: only `--face-bg`, `--face-ink`, `--face-ink-muted`, `--face-ghost`, `--color-accent`. No raw hex in `src/apps/countdown/` (the colour ratchet counts hex).
- SVG colours go through classes (`stroke-(--face-ghost)`), never `stroke="var(...)"`: a CSS var does not resolve in a bare presentation attribute.
- No `setInterval`, no `requestAnimationFrame` in the app. One `setTimeout`, gated on `isActive`.
- No emoji literals in chrome (ICO-2). The registry `icon` field takes a `\u{...}` escape.
- Copy: verb + object, no exclamation marks, no marketing register.
- `label` max 40 characters; dates are `'YYYY-MM-DD'` strings or `''`.
- Not on slowclock. No complication variant. No tap or swipe handling.
- Work lands as local commits on branch `claude/countdown-app`. No PR. End every commit message with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.

---

### Task 0: Branch

- [ ] **Step 1: Cut the task branch from the branch holding the spec**

```bash
cd "/Users/nickv/ClaudeCode Projects/SuperClock/.claude/worktrees/folders-question-e39caa"
git switch -c claude/countdown-app
ls node_modules >/dev/null 2>&1 || npm ci
```

Expected: `Switched to a new branch 'claude/countdown-app'`.

---

### Task 1: Admin date field

**Files:**
- Modify: `src/shared/types.ts` (the `format?:` line in `FieldMeta`, currently `format?: 'color' | 'url' | 'time';`)
- Modify: `src/admin/lib/schema-form.tsx` (header comment line 2; the generic string `<input type=...>` near line 124)
- Create: `src/admin/lib/schema-form.test.tsx`

**Interfaces:**
- Produces: `FieldMeta.format` accepts `'date'`; `SchemaForm` renders `<input type="date">` for it. Task 2's schema meta uses `format: 'date'`.

- [ ] **Step 1: Write the failing test**

Create `src/admin/lib/schema-form.test.tsx`:

```tsx
// @vitest-environment jsdom
import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, cleanup, fireEvent } from '@testing-library/react';
import { z } from 'zod';
import { SchemaForm } from './schema-form';

afterEach(cleanup);

const schema = z.object({ when: z.string().default('') });

describe('SchemaForm string formats', () => {
  it("renders format: 'date' as a native date input holding YYYY-MM-DD", () => {
    const onChange = vi.fn();
    const { container } = render(
      <SchemaForm
        schema={schema}
        meta={{ when: { format: 'date', label: 'When' } }}
        value={{ when: '2027-03-10' }}
        onChange={onChange}
      />,
    );
    const input = container.querySelector('input') as HTMLInputElement;
    expect(input.type).toBe('date');
    expect(input.value).toBe('2027-03-10');
    fireEvent.change(input, { target: { value: '2027-04-01' } });
    expect(onChange).toHaveBeenCalledWith({ when: '2027-04-01' });
  });

  it('allows an empty date', () => {
    const { container } = render(
      <SchemaForm schema={schema} meta={{ when: { format: 'date' } }} value={{ when: '' }} onChange={() => {}} />,
    );
    expect((container.querySelector('input') as HTMLInputElement).value).toBe('');
  });
});
```

- [ ] **Step 2: Run it and watch it fail**

Run: `npx vitest run src/admin/lib/schema-form.test.tsx`
Expected: FAIL. `tsc` would also reject `format: 'date'`; at runtime the input's `type` is `'text'`, so `expected 'text' to be 'date'`.

- [ ] **Step 3: Implement**

In `src/shared/types.ts`, change the `FieldMeta` line to:

```ts
  format?: 'color' | 'url' | 'time' | 'date';
```

In `src/admin/lib/schema-form.tsx`, change header line 2 to:

```ts
// Supports: string (with format: 'color' | 'url' | 'time' | 'date'), number (with
```

and replace the generic input's `type={...}` expression with:

```tsx
                type={
                  fmeta.format === 'url'
                    ? 'url'
                    : fmeta.format === 'time'
                      ? 'time'
                      : fmeta.format === 'date'
                        ? 'date'
                        : 'text'
                }
```

- [ ] **Step 4: Run it and watch it pass**

Run: `npx vitest run src/admin/lib/schema-form.test.tsx`
Expected: 2 passed.

- [ ] **Step 5: Commit**

```bash
git add src/shared/types.ts src/admin/lib/schema-form.tsx src/admin/lib/schema-form.test.tsx
git commit -m "feat(admin): format 'date' renders a native date input

The last field type the admin template was missing (board frame D20).

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 2: Scaffold the app and write its schema

**Files:**
- Created by the scaffolder: `src/apps/countdown/index.ts`, `src/apps/countdown/CountdownApp.tsx`, `src/apps/countdown/countdown.todo.test.ts`, `src/shared/schemas/app.countdown.ts`
- Modified by the scaffolder: `src/apps/index.ts`, `src/shared/capabilities.ts`, `src/shared/app-capabilities.ts`, `src/shared/schema-registry.ts`
- Modify by hand: `src/shared/schemas/app.countdown.ts`, `src/apps/countdown/index.ts`, `src/shared/app-capabilities.ts`
- Regenerate: `src/shared/schemas.snapshot.json`

**Interfaces:**
- Produces: `countdownAppSchema`, `countdownAppMeta`, `type CountdownAppConfig = { label: string; targetDate: string; style: 'days' | 'weeks' | 'progress-ring'; startDate: string }` from `src/shared/schemas/app.countdown.ts`.

- [ ] **Step 1: Scaffold**

Run: `npm run new:app -- countdown`
Expected: `new:app — scaffolded 'countdown'. Next steps: ...`

- [ ] **Step 2: Write the schema**

Replace the whole of `src/shared/schemas/app.countdown.ts` with:

```ts
import { z } from 'zod';
import type { FieldMetaMap } from '../types';

// Dates are plain 'YYYY-MM-DD' strings so an empty or malformed value degrades
// to the "Not set up" screen instead of failing safeParse and reverting the
// whole config. label is born with its cap: narrowing a bound later is a
// breaking change under the schema snapshot gate.
export const countdownAppSchema = z.object({
  label: z.string().max(40).default(''),
  targetDate: z.string().default(''),
  style: z.enum(['days', 'weeks', 'progress-ring']).default('days'),
  startDate: z.string().default(''),
});

export const countdownAppMeta: FieldMetaMap = {
  label: { description: 'What the date is, shown under the number. Up to 40 characters.', placeholder: 'Tokyo' },
  targetDate: { format: 'date', label: 'Target date' },
  style: { description: 'Days, weeks plus days, or days with a ring showing how much of the wait has passed' },
  startDate: {
    format: 'date',
    label: 'Start date',
    description: 'Where the progress ring starts. Without it the ring is not drawn.',
    showIf: (v) => v.style === 'progress-ring',
  },
};

export type CountdownAppConfig = z.infer<typeof countdownAppSchema>;
```

- [ ] **Step 3: Fill in the registration**

Replace the whole of `src/apps/countdown/index.ts` with:

```ts
import { lazy } from 'react';
import { registerApp } from '../../core/registry';

registerApp({
  metadata: {
    id: 'countdown',
    name: 'Countdown',
    icon: '\u{23F3}',
    description: 'Days to a date',
    category: 'utility',
  },
  component: lazy(() => import('./CountdownApp')),
});
```

- [ ] **Step 4: Declare the capability row**

In `src/shared/app-capabilities.ts`, replace the scaffolded line
`  'countdown': [], // SCAFFOLD-TODO: declare ...` with:

```ts
  // One midnight setTimeout, which is not a tick (ticks = setInterval or rAF).
  countdown: [],
```

- [ ] **Step 5: Snapshot the new schema and run the suite**

Run: `npm run snapshot:schemas && npx vitest run`
Expected: the snapshot writes (a new schema is a minor change). The suite is green except `src/apps/countdown/countdown.todo.test.ts`, which fails with `implement src/apps/countdown/CountdownApp.tsx, remove its SCAFFOLD-TODO marker...`, plus any registry-contract failure naming the missing `APP_ICONS`/`app-names` entries (Task 5 adds those). Note which tests fail; nothing else may.

- [ ] **Step 6: Commit**

```bash
git add src/apps/countdown src/apps/index.ts src/shared/capabilities.ts src/shared/app-capabilities.ts src/shared/schema-registry.ts src/shared/schemas/app.countdown.ts src/shared/schemas.snapshot.json
git commit -m "feat(countdown): scaffold the app and its app.countdown schema

Red by construction until the component lands (countdown.todo.test.ts).

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 3: Date logic

**Files:**
- Create: `src/apps/countdown/countdown-state.ts`
- Test: `src/apps/countdown/countdown-state.test.ts`

**Interfaces:**
- Consumes: `CountdownAppConfig` (Task 2).
- Produces:
  - `interface LocalDate { y: number; m: number; d: number }`
  - `type RingView = { fraction: number; spent: boolean } | { missingStart: true }`
  - `type CountdownView = { kind: 'not-set-up' } | { kind: 'until'; unit: 'days' | 'weeks'; value: number; remainderDays: number; ring: RingView | null } | { kind: 'today'; ring: RingView | null } | { kind: 'since'; unit: 'days' | 'weeks'; value: number; remainderDays: number; ring: RingView | null }`
  - `parseDate(s: string): LocalDate | null`
  - `localToday(now: Date): LocalDate`
  - `countdownState(today: LocalDate, config: CountdownAppConfig): CountdownView`
  - `msUntilNextLocalMidnight(now: Date): number`

- [ ] **Step 1: Write the failing tests**

Create `src/apps/countdown/countdown-state.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { countdownState, localToday, msUntilNextLocalMidnight, parseDate } from './countdown-state';
import { countdownAppSchema } from '../../shared/schemas/app.countdown';

const cfg = (over: Record<string, unknown>) => countdownAppSchema.parse(over);
const day = (s: string) => parseDate(s)!;

describe('parseDate', () => {
  it('accepts a real calendar date', () => {
    expect(parseDate('2027-03-10')).toEqual({ y: 2027, m: 3, d: 10 });
  });
  it.each(['', '2027-3-10', '2027-02-30', '2027-13-01', '0050-01-01', 'tomorrow'])('rejects %j', (s) => {
    expect(parseDate(s)).toBeNull();
  });
});

describe('countdownState', () => {
  it('is not set up without a valid target date', () => {
    expect(countdownState(day('2026-10-01'), cfg({}))).toEqual({ kind: 'not-set-up' });
    expect(countdownState(day('2026-10-01'), cfg({ targetDate: '2026-02-30' }))).toEqual({ kind: 'not-set-up' });
  });

  it('counts days until', () => {
    expect(countdownState(day('2026-08-08'), cfg({ targetDate: '2027-03-10' }))).toEqual({
      kind: 'until', unit: 'days', value: 214, remainderDays: 0, ring: null,
    });
  });

  it('counts one day until', () => {
    expect(countdownState(day('2027-03-09'), cfg({ targetDate: '2027-03-10' }))).toMatchObject({ kind: 'until', value: 1 });
  });

  it('is today on the date', () => {
    expect(countdownState(day('2027-03-10'), cfg({ targetDate: '2027-03-10' }))).toEqual({ kind: 'today', ring: null });
  });

  it('counts up after the date', () => {
    expect(countdownState(day('2027-03-22'), cfg({ targetDate: '2027-03-10' }))).toEqual({
      kind: 'since', unit: 'days', value: 12, remainderDays: 0, ring: null,
    });
    expect(countdownState(day('2027-03-11'), cfg({ targetDate: '2027-03-10' }))).toMatchObject({ kind: 'since', value: 1 });
  });

  it('splits weeks and remainder days in the weeks style', () => {
    const c = cfg({ targetDate: '2027-03-10', style: 'weeks' });
    expect(countdownState(day('2026-08-08'), c)).toMatchObject({ unit: 'weeks', value: 30, remainderDays: 4 });
    expect(countdownState(day('2027-02-24'), c)).toMatchObject({ unit: 'weeks', value: 2, remainderDays: 0 });
    expect(countdownState(day('2027-03-03'), c)).toMatchObject({ unit: 'weeks', value: 1, remainderDays: 0 });
    expect(countdownState(day('2027-03-17'), c)).toMatchObject({ kind: 'since', unit: 'weeks', value: 1, remainderDays: 0 });
  });

  it('forces weeks at 10 000 days or more', () => {
    expect(countdownState(day('2026-01-01'), cfg({ targetDate: '2053-05-19' }))).toMatchObject({ unit: 'weeks', value: 1428, remainderDays: 4 });
    expect(countdownState(day('2026-01-01'), cfg({ targetDate: '2053-05-18' }))).toMatchObject({ unit: 'days', value: 9999 });
  });

  it('does not lose or gain a day across DST changes (calendar dates, not milliseconds)', () => {
    // US spring-forward 2027-03-14 and fall-back 2026-11-01.
    expect(countdownState(day('2027-03-13'), cfg({ targetDate: '2027-03-15' }))).toMatchObject({ value: 2 });
    expect(countdownState(day('2026-10-31'), cfg({ targetDate: '2026-11-02' }))).toMatchObject({ value: 2 });
  });

  describe('progress ring', () => {
    const ring = (today: string, over: Record<string, unknown>) =>
      (countdownState(day(today), cfg({ style: 'progress-ring', targetDate: '2027-01-11', ...over })) as { ring: unknown }).ring;

    it('is the elapsed share between start and target', () => {
      expect(ring('2027-01-01', { startDate: '2027-01-01' })).toEqual({ fraction: 0, spent: false });
      expect(ring('2027-01-06', { startDate: '2027-01-01' })).toEqual({ fraction: 0.5, spent: false });
    });

    it('clamps to 0 before the start date', () => {
      expect(ring('2026-12-01', { startDate: '2027-01-01' })).toEqual({ fraction: 0, spent: false });
    });

    it('is spent (full, no accent) on and after the date', () => {
      expect(ring('2027-01-11', { startDate: '2027-01-01' })).toEqual({ fraction: 1, spent: true });
      expect(ring('2027-02-01', {})).toEqual({ fraction: 1, spent: true });
    });

    it.each(['', '2027-02-30', '2027-01-11', '2027-02-01'])('reports a missing start for %j', (startDate) => {
      expect(ring('2027-01-05', { startDate })).toEqual({ missingStart: true });
    });

    it('is null for the other styles', () => {
      expect(ring('2027-01-05', { style: 'days', startDate: '2027-01-01' })).toBeNull();
    });
  });
});

describe('localToday', () => {
  it('reads the local calendar date', () => {
    expect(localToday(new Date(2027, 2, 10, 23, 59))).toEqual({ y: 2027, m: 3, d: 10 });
  });
});

describe('msUntilNextLocalMidnight', () => {
  // Property over a whole year in the host time zone. On a host with DST
  // (Nick's Mac: America/New_York) this crosses both transitions.
  it('always lands exactly on the next local midnight', () => {
    for (let i = 0; i < 366; i++) {
      for (const [h, min] of [[0, 0], [12, 0], [23, 59]]) {
        const now = new Date(2026, 0, 1 + i, h, min, 30);
        const at = new Date(now.getTime() + msUntilNextLocalMidnight(now));
        expect([at.getHours(), at.getMinutes(), at.getSeconds()]).toEqual([0, 0, 0]);
        expect(at.getDate()).toBe(new Date(2026, 0, 2 + i).getDate());
      }
    }
  });
});
```

- [ ] **Step 2: Run them and watch them fail**

Run: `npx vitest run src/apps/countdown/countdown-state.test.ts`
Expected: FAIL with `Failed to resolve import "./countdown-state"`.

- [ ] **Step 3: Implement**

Create `src/apps/countdown/countdown-state.ts`:

```ts
// Pure date logic for the Countdown app. Days are counted between calendar
// dates via Date.UTC day numbers, never by dividing a local-time gap by
// 86 400 000: across a DST change a local day is 23 or 25 hours long.
import type { CountdownAppConfig } from '../../shared/schemas/app.countdown';

export interface LocalDate {
  y: number;
  m: number;
  d: number;
}

export type RingView = { fraction: number; spent: boolean } | { missingStart: true };

export type CountdownView =
  | { kind: 'not-set-up' }
  | { kind: 'until'; unit: 'days' | 'weeks'; value: number; remainderDays: number; ring: RingView | null }
  | { kind: 'today'; ring: RingView | null }
  | { kind: 'since'; unit: 'days' | 'weeks'; value: number; remainderDays: number; ring: RingView | null };

const DAY_MS = 86_400_000;
/** From here the number would need five digits, so it switches to weeks. */
const WEEKS_FROM_DAYS = 10_000;

/** 'YYYY-MM-DD' that names a real calendar date, else null. */
export function parseDate(s: string): LocalDate | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
  if (!match) return null;
  const y = Number(match[1]);
  const m = Number(match[2]);
  const d = Number(match[3]);
  const t = new Date(Date.UTC(y, m - 1, d));
  if (t.getUTCFullYear() !== y || t.getUTCMonth() !== m - 1 || t.getUTCDate() !== d) return null;
  return { y, m, d };
}

export function localToday(now: Date): LocalDate {
  return { y: now.getFullYear(), m: now.getMonth() + 1, d: now.getDate() };
}

function dayNumber(x: LocalDate): number {
  return Math.round(Date.UTC(x.y, x.m - 1, x.d) / DAY_MS);
}

function split(days: number, style: CountdownAppConfig['style']) {
  if (style === 'weeks' || days >= WEEKS_FROM_DAYS) {
    return { unit: 'weeks' as const, value: Math.floor(days / 7), remainderDays: days % 7 };
  }
  return { unit: 'days' as const, value: days, remainderDays: 0 };
}

function ringFor(config: CountdownAppConfig, today: LocalDate, target: LocalDate, delta: number): RingView | null {
  if (config.style !== 'progress-ring') return null;
  if (delta <= 0) return { fraction: 1, spent: true };
  const start = parseDate(config.startDate);
  if (!start || dayNumber(start) >= dayNumber(target)) return { missingStart: true };
  const span = dayNumber(target) - dayNumber(start);
  const elapsed = dayNumber(today) - dayNumber(start);
  return { fraction: Math.min(1, Math.max(0, elapsed / span)), spent: false };
}

export function countdownState(today: LocalDate, config: CountdownAppConfig): CountdownView {
  const target = parseDate(config.targetDate);
  if (!target) return { kind: 'not-set-up' };
  const delta = dayNumber(target) - dayNumber(today);
  const ring = ringFor(config, today, target, delta);
  if (delta === 0) return { kind: 'today', ring };
  const parts = split(Math.abs(delta), config.style);
  return delta > 0 ? { kind: 'until', ...parts, ring } : { kind: 'since', ...parts, ring };
}

/** Milliseconds from now to the next local midnight; the Date constructor
 *  resolves DST, so this is 23 or 25 hours on transition days. */
export function msUntilNextLocalMidnight(now: Date): number {
  const next = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
  return next.getTime() - now.getTime();
}
```

- [ ] **Step 4: Run them and watch them pass**

Run: `npx vitest run src/apps/countdown/countdown-state.test.ts`
Expected: all pass. If the 10 000-day pair fails, recompute the boundary dates with `node -e "console.log((Date.UTC(2053,4,19)-Date.UTC(2026,0,1))/864e5)"` (must print 10000) and fix the test dates, not the threshold.

- [ ] **Step 5: Commit**

```bash
git add src/apps/countdown/countdown-state.ts src/apps/countdown/countdown-state.test.ts
git commit -m "feat(countdown): calendar-date logic, weeks split and progress ring

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 4: Copy

**Files:**
- Create: `src/apps/countdown/countdown-copy.ts`
- Test: `src/apps/countdown/countdown-copy.test.ts`

**Interfaces:**
- Consumes: `CountdownView`, `parseDate` (Task 3), `CountdownAppConfig` (Task 2).
- Produces: `interface CountdownCopy { headline: string; line: string; caption: string | null; muted: boolean }` and `countdownCopy(view: CountdownView, config: CountdownAppConfig): CountdownCopy`.

- [ ] **Step 1: Write the failing tests**

Create `src/apps/countdown/countdown-copy.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { countdownCopy } from './countdown-copy';
import { countdownState, parseDate } from './countdown-state';
import { countdownAppSchema } from '../../shared/schemas/app.countdown';

const copy = (today: string, over: Record<string, unknown>) => {
  const config = countdownAppSchema.parse(over);
  return countdownCopy(countdownState(parseDate(today)!, config), config);
};

describe('countdownCopy', () => {
  it('days until', () => {
    expect(copy('2026-08-08', { targetDate: '2027-03-10', label: 'Tokyo' })).toEqual({
      headline: '214', line: 'days to Tokyo', caption: null, muted: false,
    });
  });
  it('singular day', () => {
    expect(copy('2027-03-09', { targetDate: '2027-03-10', label: 'Tokyo' }).line).toBe('day to Tokyo');
  });
  it('drops "to" when there is no label', () => {
    expect(copy('2026-08-08', { targetDate: '2027-03-10' }).line).toBe('days');
  });
  it('weeks with and without remainder, singular forms', () => {
    const w = { targetDate: '2027-03-10', label: 'Tokyo', style: 'weeks' };
    expect(copy('2026-08-08', w)).toMatchObject({ headline: '30', line: 'weeks, 4 days to Tokyo' });
    expect(copy('2027-02-24', w).line).toBe('weeks to Tokyo');
    expect(copy('2027-03-03', w).line).toBe('week to Tokyo');
    expect(copy('2027-03-02', w).line).toBe('week, 1 day to Tokyo');
  });
  it('today', () => {
    expect(copy('2027-03-10', { targetDate: '2027-03-10', label: 'Tokyo' })).toEqual({
      headline: 'Today', line: 'Tokyo', caption: null, muted: false,
    });
    expect(copy('2027-03-10', { targetDate: '2027-03-10' }).line).toBe('');
  });
  it('since is muted and counts up', () => {
    expect(copy('2027-03-22', { targetDate: '2027-03-10', label: 'Tokyo' })).toEqual({
      headline: '12', line: 'days since Tokyo', caption: null, muted: true,
    });
    expect(copy('2027-03-11', { targetDate: '2027-03-10', label: 'Tokyo' }).line).toBe('day since Tokyo');
  });
  it('ring captions: start date, or the missing-start prompt', () => {
    const r = { targetDate: '2027-03-10', label: 'Tokyo', style: 'progress-ring' };
    expect(copy('2026-08-08', { ...r, startDate: '2026-06-04' }).caption).toBe('since 4 Jun 2026');
    expect(copy('2026-08-08', r).caption).toBe('Add a start date to show progress');
    expect(copy('2027-03-22', { ...r, startDate: '2026-06-04' }).caption).toBeNull();
  });
  it('not set up', () => {
    expect(copy('2026-10-01', {})).toEqual({
      headline: 'No date yet', line: 'Set a target date for this screen in the admin.', caption: null, muted: false,
    });
  });
});
```

- [ ] **Step 2: Run them and watch them fail**

Run: `npx vitest run src/apps/countdown/countdown-copy.test.ts`
Expected: FAIL with `Failed to resolve import "./countdown-copy"`.

- [ ] **Step 3: Implement**

Create `src/apps/countdown/countdown-copy.ts`:

```ts
// Every string the Countdown screen shows, derived from the view model. Kept
// apart from the component so the copy rules are unit-tested without a DOM.
import type { CountdownAppConfig } from '../../shared/schemas/app.countdown';
import { parseDate, type CountdownView } from './countdown-state';

export interface CountdownCopy {
  headline: string;
  line: string;
  caption: string | null;
  muted: boolean;
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

const plural = (n: number, one: string, many: string) => (n === 1 ? one : many);

function amount(view: Extract<CountdownView, { kind: 'until' | 'since' }>): string {
  if (view.unit === 'days') return plural(view.value, 'day', 'days');
  const weeks = plural(view.value, 'week', 'weeks');
  if (view.remainderDays === 0) return weeks;
  return `${weeks}, ${view.remainderDays} ${plural(view.remainderDays, 'day', 'days')}`;
}

function caption(view: CountdownView, config: CountdownAppConfig): string | null {
  if (view.kind === 'not-set-up' || !view.ring) return null;
  if ('missingStart' in view.ring) return 'Add a start date to show progress';
  if (view.ring.spent) return null;
  const start = parseDate(config.startDate);
  return start ? `since ${start.d} ${MONTHS[start.m - 1]} ${start.y}` : null;
}

export function countdownCopy(view: CountdownView, config: CountdownAppConfig): CountdownCopy {
  const label = config.label.trim();
  switch (view.kind) {
    case 'not-set-up':
      return { headline: 'No date yet', line: 'Set a target date for this screen in the admin.', caption: null, muted: false };
    case 'today':
      return { headline: 'Today', line: label, caption: caption(view, config), muted: false };
    case 'until':
    case 'since': {
      const joiner = view.kind === 'until' ? 'to' : 'since';
      const line = label ? `${amount(view)} ${joiner} ${label}` : amount(view);
      return { headline: String(view.value), line, caption: caption(view, config), muted: view.kind === 'since' };
    }
  }
}
```

- [ ] **Step 4: Run them and watch them pass**

Run: `npx vitest run src/apps/countdown/countdown-copy.test.ts`
Expected: all pass.

- [ ] **Step 5: Commit**

```bash
git add src/apps/countdown/countdown-copy.ts src/apps/countdown/countdown-copy.test.ts
git commit -m "feat(countdown): copy rules for every state

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 5: The component, its tile and the admin names

**Files:**
- Modify: `src/apps/countdown/CountdownApp.tsx` (replace the scaffold)
- Delete: `src/apps/countdown/countdown.todo.test.ts`
- Test: `src/apps/countdown/CountdownApp.test.tsx`
- Create: `public/countdown-thumb.svg`
- Modify: `src/shared/app-icons.ts`, `src/admin/lib/app-names.ts`, `src/core/components/AppGrid.tsx`

**Interfaces:**
- Consumes: `countdownState`, `localToday`, `msUntilNextLocalMidnight`, `RingView` (Task 3); `countdownCopy` (Task 4); `countdownAppSchema` (Task 2).
- Produces: default export `CountdownApp({ isActive, config }: AppProps)`.

- [ ] **Step 1: Write the failing component test**

Create `src/apps/countdown/CountdownApp.test.tsx`:

```tsx
// @vitest-environment jsdom
import { describe, it, expect, afterEach, beforeEach, vi } from 'vitest';
import { render, screen, cleanup, act } from '@testing-library/react';
import CountdownApp from './CountdownApp';

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date(2026, 7, 8, 9, 0, 0)); // 8 Aug 2026, local
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe('CountdownApp', () => {
  it('shows days until the date', () => {
    render(<CountdownApp isActive config={{ targetDate: '2027-03-10', label: 'Tokyo' }} />);
    expect(screen.getByText('214')).toBeTruthy();
    expect(screen.getByText('days to Tokyo').className).toContain('line-clamp-2');
  });

  it('shows the not-set-up sentence without a date', () => {
    render(<CountdownApp isActive config={{}} />);
    expect(screen.getByText('No date yet')).toBeTruthy();
    expect(screen.getByText('Set a target date for this screen in the admin.')).toBeTruthy();
  });

  it('falls back to defaults on invalid config instead of crashing', () => {
    render(<CountdownApp isActive config={{ label: 'x'.repeat(41), targetDate: '2027-03-10' }} />);
    expect(screen.getByText('No date yet')).toBeTruthy();
  });

  it('draws the accent ring only before the date, and a muted full ring after', () => {
    const { container, rerender } = render(
      <CountdownApp isActive config={{ targetDate: '2027-03-10', style: 'progress-ring', startDate: '2026-06-04' }} />,
    );
    expect(container.querySelector('circle.stroke-\\(--color-accent\\)')).toBeTruthy();
    rerender(<CountdownApp isActive config={{ targetDate: '2026-08-01', style: 'progress-ring', startDate: '2026-06-04' }} />);
    expect(container.querySelector('circle.stroke-\\(--color-accent\\)')).toBeNull();
    expect(container.querySelector('circle.stroke-\\(--face-ink-muted\\)')).toBeTruthy();
  });

  it('draws no ring and prompts when the start date is missing', () => {
    const { container } = render(<CountdownApp isActive config={{ targetDate: '2027-03-10', style: 'progress-ring' }} />);
    expect(container.querySelector('svg')).toBeNull();
    expect(screen.getByText('Add a start date to show progress')).toBeTruthy();
  });

  it('schedules nothing while inactive, one timeout while active', () => {
    render(<CountdownApp isActive={false} config={{ targetDate: '2027-03-10' }} />);
    expect(vi.getTimerCount()).toBe(0);
    cleanup();
    render(<CountdownApp isActive config={{ targetDate: '2027-03-10' }} />);
    expect(vi.getTimerCount()).toBe(1);
  });

  it('rolls over at local midnight', () => {
    render(<CountdownApp isActive config={{ targetDate: '2027-03-10' }} />);
    expect(screen.getByText('214')).toBeTruthy();
    act(() => {
      vi.advanceTimersByTime(15 * 3600 * 1000 + 1000); // 09:00 -> 00:00:01 next day
    });
    expect(screen.getByText('213')).toBeTruthy();
    expect(vi.getTimerCount()).toBe(1);
  });
});
```

- [ ] **Step 2: Run it and watch it fail**

Run: `npx vitest run src/apps/countdown/CountdownApp.test.tsx`
Expected: FAIL, the scaffold renders "Countdown scaffold", so `Unable to find an element with the text: 214`.

- [ ] **Step 3: Implement the component**

Replace the whole of `src/apps/countdown/CountdownApp.tsx` with:

```tsx
import { useEffect, useMemo, useState } from 'react';
import type { AppProps } from '../../core/types';
import { countdownAppSchema } from '../../shared/schemas/app.countdown';
import { countdownState, localToday, msUntilNextLocalMidnight, type RingView } from './countdown-state';
import { countdownCopy } from './countdown-copy';

// Ring geometry in the 1000-unit disc: outer edge at radius 460, inside the glass.
const R = 447;
const CIRCUMFERENCE = 2 * Math.PI * R;

function Ring({ ring }: { ring: Exclude<RingView, { missingStart: true }> }) {
  return (
    <svg viewBox="0 0 1000 1000" className="pointer-events-none absolute inset-0 h-full w-full" aria-hidden="true">
      {ring.spent ? (
        <circle cx="500" cy="500" r={R} strokeWidth="26" className="fill-none stroke-(--face-ink-muted)" />
      ) : (
        <>
          <circle cx="500" cy="500" r={R} strokeWidth="26" className="fill-none stroke-(--face-ghost)" />
          <circle
            cx="500"
            cy="500"
            r={R}
            strokeWidth="26"
            strokeDasharray={`${CIRCUMFERENCE * ring.fraction} ${CIRCUMFERENCE}`}
            transform="rotate(-90 500 500)"
            className="fill-none stroke-(--color-accent)"
          />
        </>
      )}
    </svg>
  );
}

/** Countdown: days to a date, "Today" on it, days since after it. Re-renders
 *  once at local midnight, and only while it is the active app. */
export default function CountdownApp({ isActive, config }: AppProps) {
  const cfg = useMemo(() => {
    const parsed = countdownAppSchema.safeParse(config ?? {});
    return parsed.success ? parsed.data : countdownAppSchema.parse({});
  }, [config]);

  const [today, setToday] = useState(() => localToday(new Date()));

  useEffect(() => {
    if (!isActive) return;
    setToday(localToday(new Date())); // catch a midnight crossed while inactive
    let id: ReturnType<typeof setTimeout>;
    const arm = () => {
      id = setTimeout(() => {
        setToday(localToday(new Date()));
        arm();
      }, msUntilNextLocalMidnight(new Date()) + 1000);
    };
    arm();
    return () => clearTimeout(id);
  }, [isActive]);

  const view = countdownState(today, cfg);
  const copy = countdownCopy(view, cfg);
  const ring = view.kind !== 'not-set-up' && view.ring && !('missingStart' in view.ring) ? view.ring : null;
  const ink = copy.muted ? 'text-(--face-ink-muted)' : 'text-(--face-ink)';

  if (view.kind === 'not-set-up') {
    return (
      <div className="theme-fade flex h-full w-full flex-col items-center justify-center gap-[1.5vmin] bg-(--face-bg) text-center">
        <p className="theme-fade text-[2.6vmin] font-medium text-(--face-ink)">{copy.headline}</p>
        <p className="theme-fade max-w-[52vmin] text-[2.2vmin] text-(--face-ink-muted)">{copy.line}</p>
      </div>
    );
  }

  return (
    <div className="theme-fade relative flex h-full w-full items-center justify-center bg-(--face-bg)">
      {ring && <Ring ring={ring} />}
      <div className="relative flex max-w-[62vmin] flex-col items-center text-center">
        <span className={`theme-fade text-[17vmin] leading-none tabular-nums ${ink}`}>{copy.headline}</span>
        {copy.line && <p className={`theme-fade mt-[3vmin] line-clamp-2 text-[2.6vmin] ${ink}`}>{copy.line}</p>}
        {copy.caption && (
          <p className="theme-fade mt-[1.5vmin] text-[2.2vmin] text-(--face-ink-muted)">{copy.caption}</p>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Remove the scaffold's todo test and run the component test**

```bash
git rm src/apps/countdown/countdown.todo.test.ts
npx vitest run src/apps/countdown
```

Expected: all countdown tests pass.

- [ ] **Step 5: Add the grid tile and admin names**

Create `public/countdown-thumb.svg` (same construction as `public/todo-thumb.svg`: dark disc, one accent element, Inter label; raw hex is allowed in `public/` art, which no gate scans):

```svg
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200">
  <circle cx="100" cy="100" r="100" fill="#101418"/>
  <circle cx="100" cy="92" r="62" fill="none" stroke="#3a3f45" stroke-width="8"/>
  <circle cx="100" cy="92" r="62" fill="none" stroke="#ff8826" stroke-width="8" stroke-dasharray="243 390" transform="rotate(-90 100 92)"/>
  <text x="100" y="106" text-anchor="middle" font-family="Inter, sans-serif" font-size="40" font-weight="400" fill="#e8e8e8">214</text>
  <text x="100" y="188" text-anchor="middle" font-family="Inter, sans-serif" font-size="22" font-weight="600" fill="#e8e8e8">Countdown</text>
</svg>
```

In `src/shared/app-icons.ts`, add after the `'claude-usage'` line:

```ts
  countdown: '/countdown-thumb.svg',
```

In `src/admin/lib/app-names.ts`, add after the `'claude-usage'` line:

```ts
  countdown: 'Countdown',
```

In `src/core/components/AppGrid.tsx`, append to `appFaces` after the `todo` entry:

```ts
  { id: 'countdown',       src: '/countdown-thumb.svg' },
```

and add it to the sixth column (three tiles today, so it becomes four like its neighbours):

```ts
  [appFaces[1], appFaces[2], appFaces[15], appFaces[16]], // Photo, Habits, Todo, Countdown
```

- [ ] **Step 6: Run the whole suite**

Run: `npx vitest run`
Expected: green, including `registry-coherence`, `registry-contract` (APP_ICONS file exists, admin name matches the kiosk's `'Countdown'`), `schema-liveness` (the component value-imports `countdownAppSchema`), `app-capabilities` (no fetch, no interval, no rAF, no swipe slot ⇒ `[]`), and `design-ratchet` (font sizes and colours unchanged). If `health-report` or `analyze` fail as stale, that is Task 6.

- [ ] **Step 7: Commit**

```bash
git add src/apps/countdown public/countdown-thumb.svg src/shared/app-icons.ts src/admin/lib/app-names.ts src/core/components/AppGrid.tsx
git commit -m "feat(countdown): the screen, its grid tile and admin names

Six states from the board draft (177:1011): days, weeks, progress ring,
today, since (muted, counting up) and not set up. Face palette, as Quote.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 6: Generated docs and the full gate

**Files:**
- Regenerate: `docs/health.md`, `docs/analysis/declared-vs-read.md`

- [ ] **Step 1: Regenerate**

```bash
npm run report
npm run analyze -- --write
```

Expected: `docs/health.md` gains a `countdown` row (capabilities empty, schema `app.countdown`, read: yes) and the count reads Apps (15) and Schemas (28). The declared-vs-read report shows every `app.countdown` field read.

- [ ] **Step 2: Run the local CI mirror**

Run: `./scripts/gates.sh`
Expected: lint, `check:tokens`, test and build all green. `npm run check:rules` must report no new hit in `src/apps/countdown/`.

- [ ] **Step 3: Commit**

```bash
git add docs/health.md docs/analysis/declared-vs-read.md
git commit -m "docs: regenerate health and declared-vs-read for Countdown

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 7: Rendered verification, unslop audit, fastclock

No code unless a check fails; a failing check sends you back to the task that owns the file.

- [ ] **Step 1: Render every state at 1080 × 1080 in the dev server**

Start the `dev` preview (`.claude/launch.json`, port 5180). Front the tab and `resize_window` to 1080 × 1080 before any measurement (a hidden pane reads zeros). Drive the kiosk to Countdown through `window.__nav` with each config below (dev admin edits only `superclock-fast`). Screenshot each in the day palette and again with the night palette applied:

1. `{ targetDate: '<today + 214 days>', label: 'Tokyo' }`
2. `{ targetDate: '<today + 214 days>', label: 'Grandma’s 90th birthday party in Lisbon', style: 'weeks' }`
3. `{ targetDate: '<today + 214 days>', label: 'Tokyo', style: 'progress-ring', startDate: '<today − 130 days>' }`
4. `{ targetDate: '<today>', label: 'Tokyo' }`
5. `{ targetDate: '<today − 12 days>', label: 'Tokyo', style: 'progress-ring', startDate: '<today − 200 days>' }`
6. `{}`

- [ ] **Step 2: Unslop Phase 2 on the screenshots**

Squint (the number dominates every non-empty state), counts (three font sizes, at most one saturated accent per screen and none in states 4 to 6), contrast (`--face-ink-muted` on `--face-bg` at 4.5:1 in both palettes; `token-contrast.test.ts` already pins the pair, confirm it is in its list), circle crop (the 40-character label's two lines and the ring sit inside the disc), motion at rest (nothing animates), hostile fixtures (40-character label, empty label, invalid date). Record each result.

- [ ] **Step 3: Deploy to fastclock (the designated test device)**

```bash
DEPLOY_ANYWAY=1 bash scripts/deploy.sh nickv2026@100.78.29.28
ssh nickv2026@100.78.29.28 'pkill -TERM chromium'
```

Expected: `Verified: 100.78.29.28 runs <sha> (claude/countdown-app)`. Add a Countdown screen to fastclock in the admin with config 1, then capture the panel:

```bash
ssh nickv2026@100.78.29.28 'export XDG_RUNTIME_DIR=/run/user/$(id -u) WAYLAND_DISPLAY=wayland-0; grim /tmp/countdown.png'
scp nickv2026@100.78.29.28:/tmp/countdown.png "/private/tmp/claude-502/-Users-nickv-ClaudeCode-Projects-SuperClock--claude-worktrees-folders-question-e39caa/2e798966-bbe5-4d24-a424-3580a1d02c9e/scratchpad/countdown-fast.png"
```

Expected: the number and label render centred on the round panel, inside the glass.

- [ ] **Step 4: Agent log**

Append a newest-first entry to `docs/agent-log.md`: what shipped (files), what was verified and how (tests, gates, screenshots, the fastclock build stamp), and what is open. Commit:

```bash
git add docs/agent-log.md
git commit -m "docs: agent-log entry for the Countdown app

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```
