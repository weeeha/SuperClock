# Fitness Workout Watchface Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn the `fitness` app from a tap-to-increment rep counter into a guided 7-minute circuit runner rendered as a watchface.

**Architecture:** A pure reducer (`circuit.ts`) owns all timing and emits audio cues as data; `FitnessApp.tsx` is a thin view that feeds it timestamps and plays what it returns. Time is derived from an absolute `phaseEndsAt` epoch, never accumulated, so drift is structurally impossible. A new `src/core/brightness-lease.ts` lets a running workout suppress night-mode dimming, because `useApplySettings` applies a CSS filter on `<html>` that a descendant cannot escape.

**Tech Stack:** React 19, TypeScript (`verbatimModuleSyntax` + `erasableSyntaxOnly`), Zustand, Tailwind v4, Zod v4, Vitest 4 (node environment — **no DOM, no `localStorage` in tests**).

**Spec:** `docs/superpowers/specs/2026-07-24-fitness-workout-design.md`

---

## Repo conventions you must follow

Read these before starting; violating them fails lint or CI.

- **Type-only imports must use `import type`.** `verbatimModuleSyntax` is on.
- **No enums.** `erasableSyntaxOnly` is on. Use string-literal unions.
- **`noUnusedLocals` / `noUnusedParameters` are on.** No unused imports or args.
- **Gate all timers on `props.isActive`.** Background apps must not tick.
- **Tests run in node.** There is no `document`, `window`, or `localStorage` in
  a test. Any module a test imports must not touch them at import time.
- **Test style:** `import { describe, it, expect } from 'vitest'`, `it.each`
  tables where the cases are tabular. See `src/shared/time-window.test.ts`.
- Run the full suite with `npm test`, a single file with
  `npx vitest run <path>`.

## File structure

| File | Responsibility |
| --- | --- |
| `src/apps/fitness/exercises.ts` | **Create.** The 12-exercise pool and 3 workout definitions. Pure data. |
| `src/apps/fitness/exercises.test.ts` | **Create.** Pool size, alternation, referential integrity. |
| `src/apps/fitness/circuit.ts` | **Create.** Pure reducer: phases, timing, cue emission. |
| `src/apps/fitness/circuit.test.ts` | **Create.** Drives whole circuits with synthetic timestamps. |
| `src/apps/fitness/streak.ts` | **Create.** Pure hearts/streak logic + thin localStorage wrapper. |
| `src/apps/fitness/streak.test.ts` | **Create.** Heart loss, month rollover, local-date correctness. |
| `src/apps/fitness/audio.ts` | **Create.** WebAudio beeps + preloaded voice clips. Browser-only. |
| `src/apps/fitness/useCircuitTimer.ts` | **Create.** rAF tick driver gated on `isActive`. |
| `src/apps/fitness/ExerciseArt.tsx` | **Create.** The Spec A/B seam. Renders a still today. |
| `src/apps/fitness/WatchFace.tsx` | **Create.** Cream disc, ring, comet, number, hearts. |
| `src/apps/fitness/FitnessApp.tsx` | **Replace.** Thin shell wiring reducer + timer + gestures + audio + lease. |
| `src/apps/fitness/index.ts` | **Modify.** Metadata copy only. |
| `src/core/brightness-lease.ts` | **Create.** Expiry-based full-brightness lease. |
| `src/core/apply-settings.ts` | **Modify.** Consult the lease when picking effective brightness. |
| `src/shared/schemas/app.fitness.ts` | **Replace.** Workout-oriented config schema. |
| `scripts/gen-voice.sh` | **Create.** Offline voice-clip generation via `say` + `ffmpeg`. |

---

### Task 1: Exercise pool and workout definitions

**Files:**
- Create: `src/apps/fitness/exercises.ts`
- Test: `src/apps/fitness/exercises.test.ts`

- [ ] **Step 1: Write the failing test**

Create `src/apps/fitness/exercises.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { EXERCISES, WORKOUTS, getWorkout, getExercise } from './exercises';

describe('exercise pool', () => {
  it('has exactly 12 exercises', () => {
    expect(EXERCISES).toHaveLength(12);
  });

  it('has unique ids', () => {
    const ids = EXERCISES.map((e) => e.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});

describe('workouts', () => {
  it('defines full-body, core and lower', () => {
    expect(WORKOUTS.map((w) => w.id).sort()).toEqual(['core', 'full-body', 'lower']);
  });

  it('only references exercises that exist in the pool', () => {
    const ids = new Set(EXERCISES.map((e) => e.id));
    for (const w of WORKOUTS) {
      for (const id of w.exerciseIds) {
        expect(ids, `${w.id} references unknown exercise ${id}`).toContain(id);
      }
    }
  });

  // Seven alternates muscle groups so each partially recovers while
  // intensity stays high. Only full-body can satisfy this — a core workout
  // is core exercises by definition.
  it('full-body never repeats a target group twice in a row', () => {
    const workout = getWorkout('full-body');
    const targets = workout.exerciseIds.map((id) => getExercise(id).target);
    for (let i = 1; i < targets.length; i++) {
      expect(targets[i], `position ${i} repeats ${targets[i]}`).not.toBe(targets[i - 1]);
    }
  });

  it('full-body uses the whole pool', () => {
    expect(getWorkout('full-body').exerciseIds).toHaveLength(12);
  });

  it('getExercise throws on an unknown id', () => {
    expect(() => getExercise('not-a-real-exercise')).toThrow();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/apps/fitness/exercises.test.ts`
Expected: FAIL — `Failed to resolve import "./exercises"`

- [ ] **Step 3: Write the implementation**

Create `src/apps/fitness/exercises.ts`:

```ts
// The exercise set is hand-authored, not imported from a dataset. The
// watchface shows only a name and an animation per exercise — no
// instructions, muscle groups or equipment tags — so an 873-entry database
// would be dead weight. See the design doc for the full rationale.

export type Target = 'upper' | 'lower' | 'core';

export interface Exercise {
  /** Also the art asset and voice clip key. */
  id: string;
  name: string;
  /** Drives the full-body alternation invariant. Never displayed. */
  target: Target;
}

export interface Workout {
  id: string;
  name: string;
  exerciseIds: string[];
  workSeconds: number;
  restSeconds: number;
  rounds: number;
}

// Ordered upper → lower → core, repeated four times.
export const EXERCISES: Exercise[] = [
  { id: 'push-ups',          name: 'Push-ups',          target: 'upper' },
  { id: 'squats',            name: 'Squats',            target: 'lower' },
  { id: 'crunches',          name: 'Crunches',          target: 'core'  },
  { id: 'bench-dips',        name: 'Bench Dips',        target: 'upper' },
  { id: 'lunges',            name: 'Lunges',            target: 'lower' },
  { id: 'plank',             name: 'Plank',             target: 'core'  },
  { id: 'shoulder-taps',     name: 'Shoulder Taps',     target: 'upper' },
  { id: 'jumping-jacks',     name: 'Jumping Jacks',     target: 'lower' },
  { id: 'mountain-climbers', name: 'Mountain Climbers', target: 'core'  },
  { id: 'push-up-rotation',  name: 'Push-up & Rotation', target: 'upper' },
  { id: 'high-knees',        name: 'High Knees',        target: 'lower' },
  { id: 'side-plank',        name: 'Side Plank',        target: 'core'  },
];

function idsFor(target: Target): string[] {
  return EXERCISES.filter((e) => e.target === target).map((e) => e.id);
}

export const WORKOUTS: Workout[] = [
  {
    id: 'full-body',
    name: 'Full Body',
    exerciseIds: EXERCISES.map((e) => e.id),
    workSeconds: 30,
    restSeconds: 10,
    rounds: 1,
  },
  {
    id: 'core',
    name: 'Core',
    exerciseIds: idsFor('core'),
    workSeconds: 30,
    restSeconds: 10,
    rounds: 2,
  },
  {
    id: 'lower',
    name: 'Lower Body',
    exerciseIds: idsFor('lower'),
    workSeconds: 30,
    restSeconds: 10,
    rounds: 2,
  },
];

export function getWorkout(id: string): Workout {
  const found = WORKOUTS.find((w) => w.id === id);
  if (!found) throw new Error(`Unknown workout: ${id}`);
  return found;
}

export function getExercise(id: string): Exercise {
  const found = EXERCISES.find((e) => e.id === id);
  if (!found) throw new Error(`Unknown exercise: ${id}`);
  return found;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/apps/fitness/exercises.test.ts`
Expected: PASS — 7 tests

- [ ] **Step 5: Commit**

```bash
git add src/apps/fitness/exercises.ts src/apps/fitness/exercises.test.ts
git commit -m "feat(fitness): hand-authored 12-exercise pool and three workouts"
```

---

### Task 2: Circuit reducer — types and the work/rest progression

**Files:**
- Create: `src/apps/fitness/circuit.ts`
- Test: `src/apps/fitness/circuit.test.ts`

- [ ] **Step 1: Write the failing test**

Create `src/apps/fitness/circuit.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { initialState, reduce, remainingMs, COUNTDOWN_MS, COMPLETE_LINGER_MS } from './circuit';
import { getWorkout } from './exercises';
import type { CircuitState, Cue } from './circuit';

const W = getWorkout('full-body');
const T0 = 1_700_000_000_000;

/** Feed a TICK at `now` and return the next state, dropping cues. */
function tick(state: CircuitState, now: number): CircuitState {
  return reduce(state, { type: 'TICK', now }, W).state;
}

describe('initialState', () => {
  it('starts ready with no timer running', () => {
    const s = initialState('full-body');
    expect(s.phase).toBe('ready');
    expect(s.phaseEndsAt).toBeNull();
    expect(s.index).toBe(0);
    expect(s.round).toBe(1);
  });
});

describe('START', () => {
  it('enters countdown for COUNTDOWN_MS', () => {
    const { state } = reduce(initialState('full-body'), { type: 'START', workoutId: 'full-body', now: T0 }, W);
    expect(state.phase).toBe('countdown');
    expect(state.phaseEndsAt).toBe(T0 + COUNTDOWN_MS);
    expect(state.startedAt).toBe(T0);
  });
});

describe('progression', () => {
  it('countdown → work on expiry', () => {
    let s = reduce(initialState('full-body'), { type: 'START', workoutId: 'full-body', now: T0 }, W).state;
    s = tick(s, T0 + COUNTDOWN_MS);
    expect(s.phase).toBe('work');
    expect(s.index).toBe(0);
    expect(s.phaseEndsAt).toBe(T0 + COUNTDOWN_MS + W.workSeconds * 1000);
  });

  it('work → rest keeps index on the exercise just finished', () => {
    let s = reduce(initialState('full-body'), { type: 'START', workoutId: 'full-body', now: T0 }, W).state;
    s = tick(s, T0 + COUNTDOWN_MS);
    s = tick(s, s.phaseEndsAt!);
    expect(s.phase).toBe('rest');
    expect(s.index).toBe(0);
  });

  it('rest → work advances the index', () => {
    let s = reduce(initialState('full-body'), { type: 'START', workoutId: 'full-body', now: T0 }, W).state;
    s = tick(s, T0 + COUNTDOWN_MS);
    s = tick(s, s.phaseEndsAt!);
    s = tick(s, s.phaseEndsAt!);
    expect(s.phase).toBe('work');
    expect(s.index).toBe(1);
  });

  it('completes after the last exercise instead of resting', () => {
    let s = reduce(initialState('full-body'), { type: 'START', workoutId: 'full-body', now: T0 }, W).state;
    s = tick(s, T0 + COUNTDOWN_MS);
    // 12 exercises: work→rest→work… ending on the 12th work.
    for (let i = 0; i < 12 * 2 - 1; i++) s = tick(s, s.phaseEndsAt!);
    expect(s.phase).toBe('complete');
    expect(s.finishedAt).toBe(s.phaseEndsAt! - COMPLETE_LINGER_MS);
  });

  it('never drifts: elapsed equals the exact circuit duration', () => {
    let s = reduce(initialState('full-body'), { type: 'START', workoutId: 'full-body', now: T0 }, W).state;
    // Tick every 97ms — deliberately not a divisor of anything.
    let now = T0;
    while (s.phase !== 'complete') {
      now += 97;
      s = tick(s, now);
    }
    const expected = COUNTDOWN_MS + 12 * W.workSeconds * 1000 + 11 * W.restSeconds * 1000;
    // Landing within one tick of exact proves no accumulated drift.
    expect(s.finishedAt! - s.startedAt!).toBeGreaterThanOrEqual(expected);
    expect(s.finishedAt! - s.startedAt!).toBeLessThan(expected + 97);
  });
});

describe('remainingMs', () => {
  it('is zero for untimed phases', () => {
    expect(remainingMs(initialState('full-body'), T0)).toBe(0);
  });

  it('never goes negative', () => {
    const { state } = reduce(initialState('full-body'), { type: 'START', workoutId: 'full-body', now: T0 }, W);
    expect(remainingMs(state, T0 + COUNTDOWN_MS + 5_000)).toBe(0);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/apps/fitness/circuit.test.ts`
Expected: FAIL — `Failed to resolve import "./circuit"`

- [ ] **Step 3: Write the implementation**

Create `src/apps/fitness/circuit.ts`:

```ts
// Pure circuit engine. No React, no timers, no clock reads — `now` is passed
// in on every event so a whole 7-minute circuit is testable in under a
// millisecond. State holds an absolute `phaseEndsAt` epoch rather than a
// decrementing counter, so timing cannot accumulate drift.

import type { Workout } from './exercises';

export const COUNTDOWN_MS = 3_000;
/** How long `complete` stays on screen before returning to `ready`. */
export const COMPLETE_LINGER_MS = 20_000;

export type Phase = 'ready' | 'countdown' | 'work' | 'rest' | 'paused' | 'complete';

export interface CircuitState {
  phase: Phase;
  workoutId: string;
  /** Index into workout.exerciseIds of the exercise being worked. */
  index: number;
  /** 1-based. */
  round: number;
  /** Epoch ms when the current timed phase ends; null when untimed. */
  phaseEndsAt: number | null;
  /** Phase interrupted by PAUSE, restored on RESUME. */
  resumePhase: Phase | null;
  resumeRemainingMs: number;
  /** Whole second last announced during countdown, so each beeps once. */
  lastCueSecond: number | null;
  startedAt: number | null;
  finishedAt: number | null;
}

export type CircuitEvent =
  | { type: 'START'; workoutId: string; now: number }
  | { type: 'TICK'; now: number }
  | { type: 'PAUSE'; now: number }
  | { type: 'RESUME'; now: number }
  | { type: 'SKIP'; now: number }
  | { type: 'ABORT'; now: number };

export type Cue =
  | { kind: 'beep'; tone: 'tick' | 'work' | 'rest' | 'finish' }
  | { kind: 'voice'; id: string };

export interface CircuitResult {
  state: CircuitState;
  cues: Cue[];
}

export function initialState(workoutId: string): CircuitState {
  return {
    phase: 'ready',
    workoutId,
    index: 0,
    round: 1,
    phaseEndsAt: null,
    resumePhase: null,
    resumeRemainingMs: 0,
    lastCueSecond: null,
    startedAt: null,
    finishedAt: null,
  };
}

export function remainingMs(state: CircuitState, now: number): number {
  if (state.phaseEndsAt === null) return 0;
  return Math.max(0, state.phaseEndsAt - now);
}

/** The exercise id currently being worked. */
export function currentExerciseId(state: CircuitState, workout: Workout): string {
  return workout.exerciseIds[state.index];
}

/** The exercise id that follows, or null if this is the final one. */
export function nextExerciseId(state: CircuitState, workout: Workout): string | null {
  if (state.index + 1 < workout.exerciseIds.length) {
    return workout.exerciseIds[state.index + 1];
  }
  return state.round < workout.rounds ? workout.exerciseIds[0] : null;
}

function isLastExercise(state: CircuitState, workout: Workout): boolean {
  return nextExerciseId(state, workout) === null;
}

function enterWork(state: CircuitState, workout: Workout, now: number): CircuitResult {
  return {
    state: {
      ...state,
      phase: 'work',
      phaseEndsAt: now + workout.workSeconds * 1000,
      lastCueSecond: null,
    },
    cues: [
      { kind: 'beep', tone: 'work' },
      { kind: 'voice', id: currentExerciseId(state, workout) },
    ],
  };
}

function enterComplete(state: CircuitState, now: number): CircuitResult {
  return {
    state: {
      ...state,
      phase: 'complete',
      phaseEndsAt: now + COMPLETE_LINGER_MS,
      finishedAt: now,
      lastCueSecond: null,
    },
    cues: [{ kind: 'beep', tone: 'finish' }],
  };
}

/** Work has ended: rest, or finish if that was the last exercise. */
function afterWork(state: CircuitState, workout: Workout, now: number): CircuitResult {
  if (isLastExercise(state, workout)) return enterComplete(state, now);
  if (workout.restSeconds === 0) return afterRest(state, workout, now);
  return {
    state: { ...state, phase: 'rest', phaseEndsAt: now + workout.restSeconds * 1000, lastCueSecond: null },
    cues: [
      { kind: 'beep', tone: 'rest' },
      { kind: 'voice', id: nextExerciseId(state, workout)! },
    ],
  };
}

/** Rest has ended: advance to the next exercise, rolling the round over. */
function afterRest(state: CircuitState, workout: Workout, now: number): CircuitResult {
  const atEndOfRound = state.index + 1 >= workout.exerciseIds.length;
  const advanced: CircuitState = atEndOfRound
    ? { ...state, index: 0, round: state.round + 1 }
    : { ...state, index: state.index + 1 };
  return enterWork(advanced, workout, now);
}

export function reduce(state: CircuitState, event: CircuitEvent, workout: Workout): CircuitResult {
  switch (event.type) {
    case 'START':
      return {
        state: {
          ...initialState(event.workoutId),
          phase: 'countdown',
          phaseEndsAt: event.now + COUNTDOWN_MS,
          startedAt: event.now,
        },
        cues: [],
      };

    case 'TICK': {
      if (state.phaseEndsAt === null) return { state, cues: [] };
      const left = remainingMs(state, event.now);

      if (left > 0) {
        // Countdown beeps once per whole second remaining (3, 2, 1).
        if (state.phase === 'countdown') {
          const second = Math.ceil(left / 1000);
          if (second !== state.lastCueSecond) {
            return {
              state: { ...state, lastCueSecond: second },
              cues: [{ kind: 'beep', tone: 'tick' }],
            };
          }
        }
        return { state, cues: [] };
      }

      switch (state.phase) {
        case 'countdown': return enterWork(state, workout, event.now);
        case 'work':      return afterWork(state, workout, event.now);
        case 'rest':      return afterRest(state, workout, event.now);
        case 'complete':  return { state: initialState(state.workoutId), cues: [] };
        default:          return { state, cues: [] };
      }
    }

    case 'PAUSE': {
      if (state.phase !== 'countdown' && state.phase !== 'work' && state.phase !== 'rest') {
        return { state, cues: [] };
      }
      return {
        state: {
          ...state,
          phase: 'paused',
          resumePhase: state.phase,
          resumeRemainingMs: remainingMs(state, event.now),
          phaseEndsAt: null,
        },
        cues: [],
      };
    }

    case 'RESUME': {
      if (state.phase !== 'paused' || state.resumePhase === null) return { state, cues: [] };
      return {
        state: {
          ...state,
          phase: state.resumePhase,
          phaseEndsAt: event.now + state.resumeRemainingMs,
          resumePhase: null,
          resumeRemainingMs: 0,
        },
        cues: [],
      };
    }

    case 'SKIP': {
      switch (state.phase) {
        case 'countdown': return enterWork(state, workout, event.now);
        case 'work':      return afterWork(state, workout, event.now);
        case 'rest':      return afterRest(state, workout, event.now);
        default:          return { state, cues: [] };
      }
    }

    case 'ABORT':
      return { state: initialState(state.workoutId), cues: [] };
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/apps/fitness/circuit.test.ts`
Expected: PASS — 9 tests

- [ ] **Step 5: Commit**

```bash
git add src/apps/fitness/circuit.ts src/apps/fitness/circuit.test.ts
git commit -m "feat(fitness): pure circuit reducer with drift-free timing"
```

---

### Task 3: Circuit reducer — pause, resume, skip, abort

**Files:**
- Modify: `src/apps/fitness/circuit.test.ts` (append)

The implementation already handles these; this task proves it.

- [ ] **Step 1: Write the failing test**

Append to `src/apps/fitness/circuit.test.ts`:

```ts
describe('pause and resume', () => {
  function intoWork(): CircuitState {
    const started = reduce(initialState('full-body'), { type: 'START', workoutId: 'full-body', now: T0 }, W).state;
    return tick(started, T0 + COUNTDOWN_MS);
  }

  it('preserves the remaining time across a pause of any length', () => {
    const s = intoWork();
    const pauseAt = s.phaseEndsAt! - 7_000; // 7s left
    const paused = reduce(s, { type: 'PAUSE', now: pauseAt }, W).state;
    expect(paused.phase).toBe('paused');
    expect(paused.resumeRemainingMs).toBe(7_000);

    // Resume ten minutes later — still 7s left, not 7s minus the pause.
    const resumed = reduce(paused, { type: 'RESUME', now: pauseAt + 600_000 }, W).state;
    expect(resumed.phase).toBe('work');
    expect(remainingMs(resumed, pauseAt + 600_000)).toBe(7_000);
  });

  it('pausing during rest resumes into rest', () => {
    let s = intoWork();
    s = tick(s, s.phaseEndsAt!); // → rest
    const paused = reduce(s, { type: 'PAUSE', now: s.phaseEndsAt! - 3_000 }, W).state;
    expect(paused.resumePhase).toBe('rest');
    expect(reduce(paused, { type: 'RESUME', now: T0 + 999_999 }, W).state.phase).toBe('rest');
  });

  it('is a no-op when already complete', () => {
    const done: CircuitState = { ...initialState('full-body'), phase: 'complete', phaseEndsAt: T0 };
    expect(reduce(done, { type: 'PAUSE', now: T0 }, W).state.phase).toBe('complete');
  });
});

describe('skip', () => {
  it('during work behaves as if work expired', () => {
    let s = reduce(initialState('full-body'), { type: 'START', workoutId: 'full-body', now: T0 }, W).state;
    s = tick(s, T0 + COUNTDOWN_MS);
    const skipped = reduce(s, { type: 'SKIP', now: T0 + COUNTDOWN_MS + 1_000 }, W).state;
    expect(skipped.phase).toBe('rest');
  });

  // The bug this guards: skipping the final exercise must complete, not
  // advance past the end of the array.
  it('on the last exercise completes rather than overrunning', () => {
    const last: CircuitState = {
      ...initialState('full-body'),
      phase: 'work',
      index: W.exerciseIds.length - 1,
      phaseEndsAt: T0 + 30_000,
      startedAt: T0,
    };
    const done = reduce(last, { type: 'SKIP', now: T0 + 5_000 }, W).state;
    expect(done.phase).toBe('complete');
    expect(done.index).toBe(W.exerciseIds.length - 1);
  });
});

describe('abort', () => {
  it('returns to a clean ready state', () => {
    let s = reduce(initialState('full-body'), { type: 'START', workoutId: 'full-body', now: T0 }, W).state;
    s = tick(s, T0 + COUNTDOWN_MS);
    const s2 = reduce(s, { type: 'ABORT', now: T0 + 10_000 }, W).state;
    expect(s2).toEqual(initialState('full-body'));
  });
});

describe('rounds', () => {
  it('rolls over to round 2 after the last exercise of a multi-round workout', () => {
    const core = getWorkout('core');
    let s = reduce(initialState('core'), { type: 'START', workoutId: 'core', now: T0 }, core).state;
    s = reduce(s, { type: 'TICK', now: T0 + COUNTDOWN_MS }, core).state;
    // Work through every exercise of round 1, ending on the last rest.
    for (let i = 0; i < core.exerciseIds.length * 2 - 1; i++) {
      s = reduce(s, { type: 'TICK', now: s.phaseEndsAt! }, core).state;
    }
    expect(s.round).toBe(2);
    expect(s.index).toBe(0);
    expect(s.phase).toBe('work');
  });
});
```

- [ ] **Step 2: Run test to verify it fails or passes**

Run: `npx vitest run src/apps/fitness/circuit.test.ts`
Expected: PASS — the reducer from Task 2 already covers these. If any fail,
fix `circuit.ts` before continuing; do not weaken the test.

- [ ] **Step 3: Commit**

```bash
git add src/apps/fitness/circuit.test.ts
git commit -m "test(fitness): pin pause/resume, skip and round-rollover behaviour"
```

---

### Task 4: Circuit reducer — audio cue emission

**Files:**
- Modify: `src/apps/fitness/circuit.test.ts` (append)

- [ ] **Step 1: Write the failing test**

Append to `src/apps/fitness/circuit.test.ts`. (`Cue` is already in the
type-import at the top of the file from Task 2 — do not add a second import
statement mid-file.)

```ts
describe('cues', () => {
  /** Collect every cue emitted while driving the circuit to `untilPhase`. */
  function cuesUntil(untilPhase: string, maxTicks = 20_000): Cue[] {
    let s = reduce(initialState('full-body'), { type: 'START', workoutId: 'full-body', now: T0 }, W).state;
    const out: Cue[] = [];
    let now = T0;
    for (let i = 0; i < maxTicks && s.phase !== untilPhase; i++) {
      now += 100;
      const r = reduce(s, { type: 'TICK', now }, W);
      s = r.state;
      out.push(...r.cues);
    }
    return out;
  }

  it('beeps exactly three times during the countdown', () => {
    const ticks = cuesUntil('work').filter((c) => c.kind === 'beep' && c.tone === 'tick');
    expect(ticks).toHaveLength(3);
  });

  it('announces the current exercise when work starts', () => {
    const cues = cuesUntil('work');
    expect(cues.at(-1)).toEqual({ kind: 'voice', id: 'push-ups' });
    expect(cues.at(-2)).toEqual({ kind: 'beep', tone: 'work' });
  });

  // The announcement must land in rest so it is audible before the next
  // exercise begins — announcing during work is too late to be useful.
  it('announces the NEXT exercise when rest starts', () => {
    const cues = cuesUntil('rest');
    expect(cues.at(-1)).toEqual({ kind: 'voice', id: 'squats' });
    expect(cues.at(-2)).toEqual({ kind: 'beep', tone: 'rest' });
  });

  it('emits a finish beep and no voice at the end', () => {
    const cues = cuesUntil('complete');
    expect(cues.at(-1)).toEqual({ kind: 'beep', tone: 'finish' });
  });

  it('emits no cues on pause or resume', () => {
    let s = reduce(initialState('full-body'), { type: 'START', workoutId: 'full-body', now: T0 }, W).state;
    s = tick(s, T0 + COUNTDOWN_MS);
    const paused = reduce(s, { type: 'PAUSE', now: T0 + COUNTDOWN_MS + 1_000 }, W);
    expect(paused.cues).toEqual([]);
    expect(reduce(paused.state, { type: 'RESUME', now: T0 + 99_000 }, W).cues).toEqual([]);
  });
});
```

- [ ] **Step 2: Run test to verify it passes**

Run: `npx vitest run src/apps/fitness/circuit.test.ts`
Expected: PASS. If the countdown beep count is wrong, the `lastCueSecond`
guard in `circuit.ts` is the thing to fix.

- [ ] **Step 3: Commit**

```bash
git add src/apps/fitness/circuit.test.ts
git commit -m "test(fitness): pin audio cue timing as data assertions"
```

---

### Task 5: Streak and hearts

**Files:**
- Create: `src/apps/fitness/streak.ts`
- Test: `src/apps/fitness/streak.test.ts`

Split deliberately: pure functions take `(state, date)` so they are testable
in the node environment; only `loadStreak`/`saveStreak` touch `localStorage`.

- [ ] **Step 1: Write the failing test**

Create `src/apps/fitness/streak.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { emptyStreak, toDateKey, toMonthKey, recordCompletion, settleMissedDays, HEARTS_PER_MONTH } from './streak';

const d = (y: number, m: number, day: number, h = 12) => new Date(y, m - 1, day, h);

describe('toDateKey', () => {
  // toISOString() would shift the key by a day in any UTC+ timezone —
  // the exact bug documented in HabitsApp.
  it('uses local calendar date, not UTC', () => {
    expect(toDateKey(new Date(2026, 6, 24, 23, 30))).toBe('2026-07-24');
    expect(toDateKey(new Date(2026, 6, 24, 0, 30))).toBe('2026-07-24');
  });

  it('zero-pads month and day', () => {
    expect(toDateKey(new Date(2026, 0, 5))).toBe('2026-01-05');
  });
});

describe('toMonthKey', () => {
  it('is year-month', () => {
    expect(toMonthKey(new Date(2026, 6, 24))).toBe('2026-07');
  });
});

describe('recordCompletion', () => {
  it('marks today done and is idempotent', () => {
    const once = recordCompletion(emptyStreak(), d(2026, 7, 24));
    const twice = recordCompletion(once, d(2026, 7, 24, 18));
    expect(twice.completions['2026-07-24']).toBe(true);
    expect(Object.keys(twice.completions)).toHaveLength(1);
  });

  it('sets lastCompletedKey', () => {
    expect(recordCompletion(emptyStreak(), d(2026, 7, 24)).lastCompletedKey).toBe('2026-07-24');
  });
});

describe('settleMissedDays', () => {
  it('is a no-op before the first ever workout', () => {
    const s = settleMissedDays(emptyStreak(), d(2026, 7, 24));
    expect(s.hearts).toBe(HEARTS_PER_MONTH);
  });

  it('costs nothing when yesterday was completed', () => {
    let s = recordCompletion(emptyStreak(), d(2026, 7, 23));
    s = settleMissedDays(s, d(2026, 7, 24));
    expect(s.hearts).toBe(HEARTS_PER_MONTH);
  });

  it('costs one heart per missed day', () => {
    let s = recordCompletion(emptyStreak(), d(2026, 7, 20));
    s = settleMissedDays(s, d(2026, 7, 23)); // missed 21st and 22nd
    expect(s.hearts).toBe(HEARTS_PER_MONTH - 2);
  });

  it('never drops below zero', () => {
    let s = recordCompletion(emptyStreak(), d(2026, 7, 1));
    s = settleMissedDays(s, d(2026, 7, 28));
    expect(s.hearts).toBe(0);
  });

  it('restores a full set of hearts on a new month', () => {
    let s = recordCompletion(emptyStreak(), d(2026, 7, 20));
    s = settleMissedDays(s, d(2026, 7, 25)); // burn some hearts
    expect(s.hearts).toBeLessThan(HEARTS_PER_MONTH);
    s = settleMissedDays(s, d(2026, 8, 1));
    expect(s.hearts).toBe(HEARTS_PER_MONTH);
    expect(s.monthKey).toBe('2026-08');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/apps/fitness/streak.test.ts`
Expected: FAIL — `Failed to resolve import "./streak"`

- [ ] **Step 3: Write the implementation**

Create `src/apps/fitness/streak.ts`:

```ts
// Three hearts per calendar month; one is lost for every day missed since
// the last completed workout. Seven's 7-month challenge and bankable pause
// days are deliberately not implemented — see the design doc.
//
// Everything above `loadStreak`/`saveStreak` is pure and takes an explicit
// Date, because Vitest runs in the node environment where there is no
// `localStorage` to stub.

export const HEARTS_PER_MONTH = 3;
const STORAGE_KEY = 'superclock-fitness-streak-v1';

export interface StreakState {
  /** Local date keys (YYYY-MM-DD) of completed workouts. */
  completions: Record<string, boolean>;
  lastCompletedKey: string | null;
  hearts: number;
  /** Month the current hearts belong to (YYYY-MM). */
  monthKey: string | null;
}

export function emptyStreak(): StreakState {
  return { completions: {}, lastCompletedKey: null, hearts: HEARTS_PER_MONTH, monthKey: null };
}

// LOCAL calendar date, never toISOString(): mixing the two shifts day keys
// by one in any UTC+ timezone, which lights up the wrong day.
export function toDateKey(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function toMonthKey(d: Date): string {
  return toDateKey(d).slice(0, 7);
}

function daysBetween(fromKey: string, to: Date): number {
  const [y, m, d] = fromKey.split('-').map(Number);
  const from = new Date(y, m - 1, d);
  const toMidnight = new Date(to.getFullYear(), to.getMonth(), to.getDate());
  return Math.round((toMidnight.getTime() - from.getTime()) / 86_400_000);
}

export function recordCompletion(state: StreakState, now: Date): StreakState {
  const key = toDateKey(now);
  const monthKey = toMonthKey(now);
  return {
    ...state,
    completions: { ...state.completions, [key]: true },
    lastCompletedKey: key,
    monthKey: state.monthKey ?? monthKey,
  };
}

/** Charge a heart for each missed day, and refill on a new month. */
export function settleMissedDays(state: StreakState, now: Date): StreakState {
  const monthKey = toMonthKey(now);
  if (state.monthKey !== null && state.monthKey !== monthKey) {
    return { ...state, hearts: HEARTS_PER_MONTH, monthKey };
  }
  if (state.lastCompletedKey === null) {
    return { ...state, monthKey: state.monthKey ?? monthKey };
  }
  // A gap of 1 day means "yesterday" — nothing missed yet.
  const missed = Math.max(0, daysBetween(state.lastCompletedKey, now) - 1);
  if (missed === 0) return state;
  return { ...state, hearts: Math.max(0, state.hearts - missed) };
}

export function loadStreak(): StreakState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? { ...emptyStreak(), ...(JSON.parse(raw) as StreakState) } : emptyStreak();
  } catch {
    return emptyStreak();
  }
}

export function saveStreak(state: StreakState): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // A full or disabled localStorage must not break the workout.
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/apps/fitness/streak.test.ts`
Expected: PASS — 10 tests

- [ ] **Step 5: Commit**

```bash
git add src/apps/fitness/streak.ts src/apps/fitness/streak.test.ts
git commit -m "feat(fitness): monthly hearts streak with local-date correctness"
```

---

### Task 6: Brightness lease in core

**Files:**
- Create: `src/core/brightness-lease.ts`
- Modify: `src/core/apply-settings.ts`

`useApplySettings` dims via `root.style.filter` on `<html>`. A descendant
cannot escape an ancestor's CSS filter, so the override must live here.
The lease carries an expiry so a crashed kiosk cannot pin the panel bright.

- [ ] **Step 1: Write the implementation**

Create `src/core/brightness-lease.ts`:

```ts
// A running workout must not be dimmed by the night-mode schedule. Because
// useApplySettings applies `filter: brightness()` to <html>, an app cannot
// opt out from inside its own subtree — the override has to be consulted at
// the point the filter is set.
//
// The lease is an expiry timestamp rather than a boolean so a crashed or
// navigated-away kiosk reverts on its own, the same guard the radar mode
// lease uses server-side.

import { useSyncExternalStore } from 'react';

/** Auto-expiry. Renewed while a circuit runs; longer than any one workout. */
export const LEASE_TTL_MS = 90_000;

let expiresAt = 0;
const listeners = new Set<() => void>();

function emit(): void {
  for (const fn of listeners) fn();
}

/** Take or renew the lease. Callers must renew well inside LEASE_TTL_MS. */
export function acquireBrightnessLease(now: number = Date.now()): void {
  expiresAt = now + LEASE_TTL_MS;
  emit();
}

export function releaseBrightnessLease(): void {
  expiresAt = 0;
  emit();
}

export function isBrightnessLeased(now: number = Date.now()): boolean {
  return now < expiresAt;
}

function subscribe(onChange: () => void): () => void {
  listeners.add(onChange);
  // Re-check on a timer too: expiry is a clock event, not a mutation, so
  // nothing would otherwise notify React when the lease lapses.
  const timer = window.setInterval(onChange, 5_000);
  return () => {
    listeners.delete(onChange);
    window.clearInterval(timer);
  };
}

export function useBrightnessLease(): boolean {
  return useSyncExternalStore(subscribe, () => isBrightnessLeased(), () => false);
}
```

- [ ] **Step 2: Wire it into apply-settings**

In `src/core/apply-settings.ts`, add the import beside the existing ones:

```ts
import { useBrightnessLease } from './brightness-lease';
```

Add inside `useApplySettings`, next to the other hook calls:

```ts
  const brightnessLeased = useBrightnessLease();
```

Replace the brightness effect body so the lease wins over the schedule:

```ts
  useEffect(() => {
    const root = document.documentElement;
    root.style.transition = 'filter 1s ease';
    // A leased screen (an in-progress workout) renders unfiltered regardless
    // of the night window — you cannot read a dimmed timer mid-exercise.
    const effective = brightnessLeased
      ? undefined
      : isNight && typeof nightBrightness === 'number'
        ? nightBrightness
        : dayBrightness;
    // ≥100 (or unset) renders unfiltered — brightness(1) would be an identity
    // filter that still costs a stacking context.
    if (typeof effective === 'number' && effective < 100) {
      const pct = Math.max(0, effective);
      root.style.filter = `brightness(${pct / 100})`;
    } else {
      root.style.filter = '';
    }
    return () => {
      root.style.filter = '';
      root.style.transition = '';
    };
  }, [isNight, nightBrightness, dayBrightness, brightnessLeased]);
```

- [ ] **Step 3: Verify it compiles and nothing regressed**

Run: `npx tsc -b && npm test`
Expected: build clean, all existing tests still pass.

- [ ] **Step 4: Commit**

```bash
git add src/core/brightness-lease.ts src/core/apply-settings.ts
git commit -m "feat(core): expiry-based brightness lease so workouts aren't dimmed"
```

---

### Task 7: Config schema

**Files:**
- Modify: `src/shared/schemas/app.fitness.ts` (replace contents)

- [ ] **Step 1: Write the implementation**

Replace `src/shared/schemas/app.fitness.ts` entirely:

```ts
import { z } from 'zod';
import type { FieldMetaMap } from '../types';

// Replaces the old rep-counter fields (exercise/dailyGoal/resetAt), which
// have no meaning now the app is workout-only. Stale keys in fleet.json are
// harmless: instance config is typed as an opaque record at the
// device-config layer, and this plain z.object strips unknown keys.
export const fitnessAppSchema = z.object({
  workoutId: z.enum(['full-body', 'core', 'lower']).default('full-body'),
  workSeconds: z.number().int().min(10).max(120).default(30),
  restSeconds: z.number().int().min(0).max(60).default(10),
  rounds: z.number().int().min(1).max(5).default(1),
  voiceCues: z.boolean().default(true),
  beeps: z.boolean().default(true),
  keepBright: z.boolean().default(true),
});

export const fitnessAppMeta: FieldMetaMap = {
  workoutId: { description: 'Which circuit runs when you tap to start' },
  workSeconds: { min: 10, max: 120, step: 5, description: 'Seconds per exercise' },
  restSeconds: { min: 0, max: 60, step: 5, description: 'Seconds between exercises (0 = no rest)' },
  rounds: { min: 1, max: 5, step: 1, description: 'Times to repeat the circuit' },
  voiceCues: { description: 'Announce each exercise by name' },
  beeps: { description: 'Countdown and transition tones' },
  keepBright: { description: 'Ignore night dimming while a workout is running' },
};

export type FitnessAppConfig = z.infer<typeof fitnessAppSchema>;
```

- [ ] **Step 2: Pin the enum to the workout list**

The `workoutId` enum and `WORKOUTS` must not drift: Task 1's accessors throw
on an unknown id precisely because the config boundary is supposed to have
already normalised it. If someone adds a workout and forgets the enum, that
guarantee silently breaks. This is the same coherence-test pattern
`registry-coherence.test.ts` already uses for apps/faces/schemas.

Append to `src/apps/fitness/exercises.test.ts`:

```ts
import { fitnessAppSchema } from '../../shared/schemas/app.fitness';

describe('config coherence', () => {
  // getWorkout throws on unknown ids, which is only safe because config is
  // validated against this enum first. Drift here reintroduces the crash.
  it('workoutId enum lists exactly the defined workouts', () => {
    const options = fitnessAppSchema.shape.workoutId.unwrap().options;
    expect([...options].sort()).toEqual(WORKOUTS.map((w) => w.id).sort());
  });
});
```

If `.unwrap().options` is not the right accessor on this zod version, find the
correct one — do not weaken the assertion to make it pass.

- [ ] **Step 3: Verify**

Run: `npx vitest run src/shared/registry-coherence.test.ts src/apps/fitness/exercises.test.ts`
Expected: PASS. The app id is unchanged, so no registry edits are needed.

- [ ] **Step 4: Commit**

```bash
git add src/shared/schemas/app.fitness.ts src/apps/fitness/exercises.test.ts
git commit -m "feat(fitness): replace rep-counter config with workout config"
```

---

### Task 8: Voice clip generation script

**Files:**
- Create: `scripts/gen-voice.sh`

- [ ] **Step 1: Write the script**

Create `scripts/gen-voice.sh` and `chmod +x` it:

```bash
#!/usr/bin/env bash
# Generate the fitness app's voice clips offline.
#
# Run on macOS (uses `say`); output is committed so the Pi never needs a TTS
# engine and the clips sound the same on every device. Re-run only when the
# exercise list changes.
#
#   ./scripts/gen-voice.sh
set -euo pipefail

VOICE="${VOICE:-Samantha}"
OUT="public/fitness/voice"
mkdir -p "$OUT"

# id|spoken text — ids must match src/apps/fitness/exercises.ts
CLIPS=(
  "push-ups|Push ups"
  "squats|Squats"
  "crunches|Crunches"
  "bench-dips|Bench dips"
  "lunges|Lunges"
  "plank|Plank"
  "shoulder-taps|Shoulder taps"
  "jumping-jacks|Jumping jacks"
  "mountain-climbers|Mountain climbers"
  "push-up-rotation|Push up and rotation"
  "high-knees|High knees"
  "side-plank|Side plank"
)

command -v ffmpeg >/dev/null || { echo "ffmpeg not found" >&2; exit 1; }
command -v say >/dev/null    || { echo "say not found (macOS only)" >&2; exit 1; }

for entry in "${CLIPS[@]}"; do
  id="${entry%%|*}"
  text="${entry#*|}"
  echo "→ $id"
  say -v "$VOICE" "$text" -o "/tmp/${id}.aiff"
  # Mono 48k AAC: small, and Chromium decodes it without extra codecs.
  ffmpeg -y -loglevel error -i "/tmp/${id}.aiff" -ac 1 -ar 48000 -b:a 64k "$OUT/${id}.m4a"
  rm -f "/tmp/${id}.aiff"
done

echo "Done — $(ls -1 "$OUT" | wc -l | tr -d ' ') clips in $OUT"
```

- [ ] **Step 2: Run it**

Run: `chmod +x scripts/gen-voice.sh && ./scripts/gen-voice.sh`
Expected: `Done — 12 clips in public/fitness/voice`

- [ ] **Step 3: Commit**

```bash
git add scripts/gen-voice.sh public/fitness/voice
git commit -m "feat(fitness): offline voice clip generation"
```

---

### Task 9: Audio playback module

**Files:**
- Create: `src/apps/fitness/audio.ts`

Browser-only; no test (there is no DOM or WebAudio in the node test env).
Correctness of *when* cues fire is already covered by `circuit.test.ts`.

- [ ] **Step 1: Write the implementation**

Create `src/apps/fitness/audio.ts`:

```ts
// Beeps are synthesised so there are no tone assets to ship; exercise names
// are pre-recorded clips (see scripts/gen-voice.sh) because Pi TTS quality
// is unreliable.
//
// The kiosk already launches Chromium with
// --autoplay-policy=no-user-gesture-required, so nothing needs unlocking.

import type { Cue } from './circuit';

const TONE_HZ: Record<string, number> = {
  tick: 660,
  work: 880,
  rest: 440,
  finish: 1320,
};

const TONE_MS: Record<string, number> = {
  tick: 90,
  work: 180,
  rest: 180,
  finish: 420,
};

export class WorkoutAudio {
  private ctx: AudioContext | null = null;
  private clips = new Map<string, HTMLAudioElement>();

  constructor(
    private readonly opts: { beeps: boolean; voice: boolean },
  ) {}

  /** Fetch every clip up front — a name announced 200ms late is worse than
   *  silence, so nothing may be loaded at the phase boundary. */
  preload(exerciseIds: string[]): void {
    if (!this.opts.voice) return;
    for (const id of exerciseIds) {
      if (this.clips.has(id)) continue;
      const el = new Audio(`/fitness/voice/${id}.m4a`);
      el.preload = 'auto';
      el.load();
      this.clips.set(id, el);
    }
  }

  play(cue: Cue): void {
    if (cue.kind === 'beep') this.beep(cue.tone);
    else this.speak(cue.id);
  }

  private beep(tone: string): void {
    if (!this.opts.beeps) return;
    const ctx = this.context();
    if (!ctx) return;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.value = TONE_HZ[tone] ?? 660;
    const seconds = (TONE_MS[tone] ?? 120) / 1000;
    // Ramp rather than a hard stop; a square cut-off clicks audibly.
    gain.gain.setValueAtTime(0.0001, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.3, ctx.currentTime + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + seconds);
    osc.connect(gain).connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + seconds + 0.02);
  }

  private speak(id: string): void {
    if (!this.opts.voice) return;
    const el = this.clips.get(id);
    if (!el) return;
    el.currentTime = 0;
    void el.play().catch(() => {
      // Autoplay refusal or a missing clip must not break the circuit.
    });
  }

  private context(): AudioContext | null {
    if (this.ctx === null) {
      try {
        this.ctx = new AudioContext();
      } catch {
        return null;
      }
    }
    if (this.ctx.state === 'suspended') void this.ctx.resume();
    return this.ctx;
  }

  dispose(): void {
    void this.ctx?.close();
    this.ctx = null;
    this.clips.clear();
  }
}
```

- [ ] **Step 2: Verify it compiles**

Run: `npx tsc -b`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/apps/fitness/audio.ts
git commit -m "feat(fitness): WebAudio beeps and preloaded voice clips"
```

---

### Task 10: ExerciseArt — the Spec A/B seam

**Files:**
- Create: `src/apps/fitness/ExerciseArt.tsx`

- [ ] **Step 1: Write the implementation**

Create `src/apps/fitness/ExerciseArt.tsx`:

```tsx
// The entire boundary between this spec and the animation pipeline. The prop
// signature is fixed now and must not change: Spec B replaces the internals
// with a sprite atlas and no caller is touched.
//
// `phase` is deliberately narrower than the reducer's six-value Phase —
// countdown hides the art, and ready/paused/complete reuse the neutral pose,
// so only these two values change what is drawn.

interface ExerciseArtProps {
  exerciseId: string;
  phase: 'work' | 'rest';
  /** False while paused — Spec B freezes the atlas on the current frame. */
  playing: boolean;
}

export default function ExerciseArt({ exerciseId, phase, playing }: ExerciseArtProps) {
  const src = phase === 'rest' ? '/fitness/neutral.png' : `/fitness/${exerciseId}.png`;
  return (
    <img
      src={src}
      alt=""
      draggable={false}
      className="h-full w-full object-contain select-none"
      style={{ opacity: playing ? 1 : 0.45, transition: 'opacity 200ms ease' }}
    />
  );
}
```

- [ ] **Step 2: Add placeholder art**

Place the generated character at `public/fitness/neutral.png` and one image
per exercise id at `public/fitness/<id>.png` (12 files). Until the real
renders exist, copy `neutral.png` to each id so nothing 404s:

```bash
mkdir -p public/fitness
for id in push-ups squats crunches bench-dips lunges plank shoulder-taps \
          jumping-jacks mountain-climbers push-up-rotation high-knees side-plank; do
  cp public/fitness/neutral.png "public/fitness/$id.png"
done
```

- [ ] **Step 3: Commit**

```bash
git add src/apps/fitness/ExerciseArt.tsx public/fitness
git commit -m "feat(fitness): ExerciseArt seam with placeholder stills"
```

---

### Task 11: WatchFace presentation

**Files:**
- Create: `src/apps/fitness/WatchFace.tsx`

- [ ] **Step 1: Write the implementation**

Create `src/apps/fitness/WatchFace.tsx`:

```tsx
// The Figma watchface (Clock-Design-WIP, node 681:25972): cream disc, red →
// orange progress ring with a comet at the leading tip, large dark number,
// hearts. Rest inverts the disc to dark — this palette is already red/orange
// so a hue flip has nowhere to go, and inverting lightness gives the same
// across-the-room legibility while reading as "off".
//
// Everything is laid out in a 1000×1000 viewBox and scaled by the SVG, so
// there are no hardcoded 1080 values and the 800×480 device needs only a
// container change.

import ExerciseArt from './ExerciseArt';

const CX = 500;
const CY = 500;
const RING_R = 452;
const RING_W = 44;

export interface WatchFaceProps {
  /** 0–1 of the ring to fill. */
  progress: number;
  /** Large centred readout: the countdown, or a label like "FULL BODY". */
  headline: string;
  /** Small caption under the figure. */
  caption?: string;
  heartsTotal: number;
  heartsLeft: number;
  exerciseId: string | null;
  artPhase: 'work' | 'rest';
  playing: boolean;
  inverted: boolean;
}

function polar(r: number, deg: number): [number, number] {
  const rad = ((deg - 90) * Math.PI) / 180;
  return [CX + r * Math.cos(rad), CY + r * Math.sin(rad)];
}

export default function WatchFace(props: WatchFaceProps) {
  const { progress, headline, caption, heartsTotal, heartsLeft } = props;
  const { exerciseId, artPhase, playing, inverted } = props;

  const circumference = 2 * Math.PI * RING_R;
  const clamped = Math.min(1, Math.max(0, progress));
  const [cometX, cometY] = polar(RING_R, clamped * 360);

  const face = inverted ? '#17181a' : '#f5f0eb';
  const track = inverted ? '#2a2c30' : '#e6ddd4';
  const ink = inverted ? '#f3efe9' : '#2a2d33';
  const muted = inverted ? '#8e8b86' : '#8b8279';

  return (
    <div className="flex h-full w-full items-center justify-center" style={{ background: face }}>
      <svg viewBox="0 0 1000 1000" className="h-full w-full max-h-full max-w-full">
        <defs>
          <linearGradient id="fitRing" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#8b1a1a" />
            <stop offset="55%" stopColor="#e33030" />
            <stop offset="100%" stopColor="#ff7a00" />
          </linearGradient>
        </defs>

        <circle cx={CX} cy={CY} r={RING_R} fill="none" stroke={track} strokeWidth={RING_W} />

        {clamped > 0 && (
          <circle
            cx={CX} cy={CY} r={RING_R}
            fill="none"
            stroke="url(#fitRing)"
            strokeWidth={RING_W}
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={circumference * (1 - clamped)}
            style={{ transform: 'rotate(-90deg)', transformOrigin: `${CX}px ${CY}px` }}
          />
        )}

        {clamped > 0 && <circle cx={cometX} cy={cometY} r={22} fill="#ffb03a" />}

        <text
          x={CX} y={230}
          textAnchor="middle" dominantBaseline="middle"
          fill={ink}
          fontFamily="Inter, sans-serif"
          fontWeight="850"
          fontSize={headline.length > 3 ? 96 : 168}
          letterSpacing="-0.03em"
        >
          {headline}
        </text>

        {exerciseId && (
          <foreignObject x={280} y={300} width={440} height={400}>
            <ExerciseArt exerciseId={exerciseId} phase={artPhase} playing={playing} />
          </foreignObject>
        )}

        {caption && (
          <text
            x={CX} y={772}
            textAnchor="middle"
            fill={muted}
            fontFamily="Inter, sans-serif"
            fontWeight="650"
            fontSize={34}
            letterSpacing="0.08em"
          >
            {caption.toUpperCase()}
          </text>
        )}

        <g>
          {Array.from({ length: heartsTotal }, (_, i) => (
            <text
              key={i}
              x={CX - (heartsTotal - 1) * 40 + i * 80}
              y={860}
              textAnchor="middle"
              fontSize={58}
              opacity={i < heartsLeft ? 1 : 0.22}
            >
              {'❤️'}
            </text>
          ))}
        </g>
      </svg>
    </div>
  );
}
```

- [ ] **Step 2: Verify it compiles**

Run: `npx tsc -b`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/apps/fitness/WatchFace.tsx
git commit -m "feat(fitness): watchface presentation with ring, comet and hearts"
```

---

### Task 12: Tick driver

**Files:**
- Create: `src/apps/fitness/useCircuitTimer.ts`

- [ ] **Step 1: Write the implementation**

Create `src/apps/fitness/useCircuitTimer.ts`:

```ts
// Drives TICK events while the app is the active screen. rAF rather than
// setInterval so the browser throttles it when the tab is hidden, and so
// ticking stops the moment the app is swiped away — background apps must
// not tick (CLAUDE.md), and a kiosk runs for weeks.

import { useEffect, useRef } from 'react';

/** ~10Hz is plenty: the display only shows whole seconds. */
const MIN_TICK_MS = 100;

export function useCircuitTimer(active: boolean, onTick: (now: number) => void): void {
  const cb = useRef(onTick);
  cb.current = onTick;

  useEffect(() => {
    if (!active) return;
    let raf = 0;
    let last = 0;
    const loop = (t: number) => {
      if (t - last >= MIN_TICK_MS) {
        last = t;
        cb.current(Date.now());
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [active]);
}
```

- [ ] **Step 2: Commit**

```bash
git add src/apps/fitness/useCircuitTimer.ts
git commit -m "feat(fitness): isActive-gated rAF tick driver"
```

---

### Task 13: FitnessApp shell

**Files:**
- Modify: `src/apps/fitness/FitnessApp.tsx` (replace entirely)
- Modify: `src/apps/fitness/index.ts`

- [ ] **Step 1: Replace the component**

Replace `src/apps/fitness/FitnessApp.tsx` entirely:

```tsx
// Thin shell. All timing, phase transitions and cue decisions live in
// circuit.ts; this component feeds it timestamps, renders the result and
// plays whatever cues it returns.

import { useEffect, useMemo, useRef, useState } from 'react';
import type { AppProps } from '../../core/types';
import { useNavigation } from '../../core/navigation';
import { acquireBrightnessLease, releaseBrightnessLease } from '../../core/brightness-lease';
import { fitnessAppSchema } from '../../shared/schemas/app.fitness';
import { getExercise, getWorkout, WORKOUTS } from './exercises';
import type { Workout } from './exercises';
import { initialState, reduce, remainingMs, currentExerciseId, nextExerciseId } from './circuit';
import type { CircuitState } from './circuit';
import { useCircuitTimer } from './useCircuitTimer';
import { WorkoutAudio } from './audio';
import { loadStreak, saveStreak, recordCompletion, settleMissedDays, HEARTS_PER_MONTH } from './streak';
import WatchFace from './WatchFace';

/** Renew well inside the lease TTL so it never lapses mid-workout. */
const LEASE_RENEW_MS = 30_000;

function formatSeconds(ms: number): string {
  return String(Math.ceil(ms / 1000));
}

function formatElapsed(ms: number): string {
  const total = Math.round(ms / 1000);
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`;
}

export default function FitnessApp({ isActive, config }: AppProps) {
  // safeParse, not parse: a zod enum only falls back to its default when the
  // key is ABSENT. A stale or hand-edited `workoutId` that isn't in the enum
  // would throw and white-screen the kiosk, so bad config degrades to
  // defaults instead.
  const cfg = useMemo(() => {
    const parsed = fitnessAppSchema.safeParse(config ?? {});
    return parsed.success ? parsed.data : fitnessAppSchema.parse({});
  }, [config]);

  // Config overrides the workout's built-in durations so the admin can retune
  // without editing code.
  const [workoutIndex, setWorkoutIndex] = useState(() =>
    Math.max(0, WORKOUTS.findIndex((w) => w.id === cfg.workoutId)),
  );
  const workout: Workout = useMemo(() => {
    const base = getWorkout(WORKOUTS[workoutIndex].id);
    return { ...base, workSeconds: cfg.workSeconds, restSeconds: cfg.restSeconds, rounds: cfg.rounds };
  }, [workoutIndex, cfg.workSeconds, cfg.restSeconds, cfg.rounds]);

  const [state, setState] = useState<CircuitState>(() => initialState(workout.id));
  const [now, setNow] = useState(() => Date.now());
  const [streak, setStreak] = useState(() => settleMissedDays(loadStreak(), new Date()));

  const setVerticalSwipeCallback = useNavigation((s) => s.setVerticalSwipeCallback);
  const showGrid = useNavigation((s) => s.showGrid);

  const audio = useRef<WorkoutAudio | null>(null);
  if (audio.current === null) {
    audio.current = new WorkoutAudio({ beeps: cfg.beeps, voice: cfg.voiceCues });
  }

  const running = state.phase === 'countdown' || state.phase === 'work' || state.phase === 'rest';

  // One place where events enter the reducer, so cues can never be missed.
  function dispatch(event: Parameters<typeof reduce>[1]): void {
    setState((prev) => {
      const { state: next, cues } = reduce(prev, event, workout);
      for (const cue of cues) audio.current?.play(cue);
      if (prev.phase !== 'complete' && next.phase === 'complete') {
        setStreak((s) => {
          const updated = recordCompletion(s, new Date());
          saveStreak(updated);
          return updated;
        });
      }
      return next;
    });
  }

  useCircuitTimer(isActive, (t) => {
    setNow(t);
    dispatch({ type: 'TICK', now: t });
  });

  // Swiping to another app must pause, not abandon — position is preserved
  // so swiping back resumes mid-exercise.
  useEffect(() => {
    if (!isActive && running) dispatch({ type: 'PAUSE', now: Date.now() });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isActive]);

  // Hold the screen at full brightness while a circuit runs.
  useEffect(() => {
    if (!running) return;
    acquireBrightnessLease();
    const timer = window.setInterval(() => acquireBrightnessLease(), LEASE_RENEW_MS);
    return () => {
      window.clearInterval(timer);
      releaseBrightnessLease();
    };
  }, [running]);

  useEffect(() => () => audio.current?.dispose(), []);

  useEffect(() => {
    if (!isActive) {
      setVerticalSwipeCallback(null);
      return;
    }
    setVerticalSwipeCallback((dir) => {
      if (dir === 'down') {
        showGrid();
        return;
      }
      if (state.phase === 'ready') setWorkoutIndex((i) => (i + 1) % WORKOUTS.length);
      else if (state.phase === 'paused') dispatch({ type: 'ABORT', now: Date.now() });
      else if (running) dispatch({ type: 'SKIP', now: Date.now() });
    });
    return () => setVerticalSwipeCallback(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isActive, state.phase, running, setVerticalSwipeCallback, showGrid]);

  function handleTap(): void {
    const t = Date.now();
    if (state.phase === 'ready') {
      audio.current?.preload(workout.exerciseIds);
      dispatch({ type: 'START', workoutId: workout.id, now: t });
    } else if (state.phase === 'paused') {
      dispatch({ type: 'RESUME', now: t });
    } else if (state.phase === 'complete') {
      dispatch({ type: 'ABORT', now: t });
    } else {
      dispatch({ type: 'PAUSE', now: t });
    }
  }

  const left = remainingMs(state, now);
  const currentId = currentExerciseId(state, workout);
  const nextId = nextExerciseId(state, workout);

  let headline = workout.name.toUpperCase();
  let caption: string | undefined = 'tap to start';
  let progress = 0;
  let artId: string | null = currentId;
  let artPhase: 'work' | 'rest' = 'work';

  if (state.phase === 'countdown') {
    headline = formatSeconds(left);
    caption = `get ready · ${getExercise(currentId).name}`;
    artId = null;
  } else if (state.phase === 'work') {
    headline = formatSeconds(left);
    caption = getExercise(currentId).name;
    progress = 1 - left / (workout.workSeconds * 1000);
  } else if (state.phase === 'rest') {
    headline = formatSeconds(left);
    caption = nextId ? `next · ${getExercise(nextId).name}` : 'rest';
    progress = 1 - left / (workout.restSeconds * 1000);
    artPhase = 'rest';
  } else if (state.phase === 'paused') {
    headline = '❚❚';
    caption = `${state.index + 1} of ${workout.exerciseIds.length} · ${getExercise(currentId).name}`;
    artPhase = state.resumePhase === 'rest' ? 'rest' : 'work';
  } else if (state.phase === 'complete') {
    headline = formatElapsed((state.finishedAt ?? 0) - (state.startedAt ?? 0));
    caption = 'well done';
    progress = 1;
    artPhase = 'rest';
  }

  return (
    <div className="h-full w-full" onClick={handleTap}>
      <WatchFace
        progress={progress}
        headline={headline}
        caption={caption}
        heartsTotal={HEARTS_PER_MONTH}
        heartsLeft={streak.hearts}
        exerciseId={artId}
        artPhase={artPhase}
        playing={state.phase !== 'paused'}
        inverted={state.phase === 'rest'}
      />
    </div>
  );
}
```

- [ ] **Step 2: Update the registration copy**

In `src/apps/fitness/index.ts`, change the description:

```ts
    description: '7-minute workout circuits with a guided timer',
```

- [ ] **Step 3: Verify everything passes**

Run: `npm run lint && npx tsc -b && npm test`
Expected: lint clean, build clean, all tests pass.

If lint objects to the two `eslint-disable-next-line react-hooks/exhaustive-deps`
comments, fix the dependency arrays properly rather than widening the
disable — the full react-hooks v7 Compiler ruleset is enabled in this repo.

- [ ] **Step 4: Commit**

```bash
git add src/apps/fitness/FitnessApp.tsx src/apps/fitness/index.ts
git commit -m "feat(fitness): wire the circuit runner into the watchface shell"
```

---

### Task 14: Verify in the browser preview

**Files:** none — verification only.

- [ ] **Step 1: Start the dev server**

Use the `preview_start` tool with `{ name: "dev" }` — the config name in
`.claude/launch.json` (port 5180). Never start a dev server with Bash.

- [ ] **Step 2: Drive the app to the fitness screen**

The preview tab is backgrounded, so rAF is throttled. Navigate via the store
rather than gestures:

```js
window.__nav.getState().switchToApp('fitness');
window.__nav.getState().finishTransition();
```

- [ ] **Step 3: Check for errors**

Use `read_console_messages` and `preview_logs`.
Expected: no errors; no 404s for `/fitness/*.png` or `/fitness/voice/*.m4a`
in `read_network_requests`.

- [ ] **Step 4: Confirm the states render**

Tap to start, then screenshot `countdown`, `work`, `rest` (disc inverted to
dark) and `paused`. Confirm the ring fills and the comet tracks its tip.

- [ ] **Step 5: Commit any fixes**

```bash
git add -A && git commit -m "fix(fitness): preview verification fixes"
```

---

### Task 15: Verify on the device

**Files:** none — verification only.

A green build is not a working watchface. This must happen before the work is
called done.

- [ ] **Step 1: Confirm audio is physically audible**

This is the spec's one unverified assumption. The Fusion HAT card exists
(`card 2: snd_rpi_googlevoicehat_soundcar`) but the SunFounder amp may need a
sysfs enable.

```bash
ssh nickv2026@100.78.29.28 'speaker-test -c2 -twav -l1'
```

Expected: audible sound. If silent, resolve the amp enable **before**
trusting any audio behaviour — do not report audio as working.

- [ ] **Step 2: Deploy**

```bash
./scripts/deploy.sh nickv2026@100.78.29.28
```

- [ ] **Step 3: Verify on the physical device**

Confirm each of these and report honestly which were checked:
- the face is legible from across the room;
- the rest inversion reads at a glance;
- beeps and exercise names are audible and land on the boundary;
- the screen does **not** dim mid-workout inside the night window;
- swiping to another app mid-circuit pauses, and swiping back resumes at the
  same second;
- a full circuit completes and the hearts render.

- [ ] **Step 4: Report results**

State plainly what passed, what failed, and anything left unverified.

---

## Self-review notes

Checked against the spec:

- Every spec section maps to a task. Streak (Task 5), brightness lease
  (Task 6), config (Task 7), voice generation (Task 8), audio (Task 9),
  the `ExerciseArt` seam (Task 10), watchface (Task 11), tick driver
  (Task 12), shell (Task 13).
- Spec items **deliberately not** implemented here, all listed as deferred in
  the spec: the `FLEET_SCHEMA_VERSION` v3 cleanup, the 800×480 layout pass,
  the comet-glyph licence check, and everything in Spec B.
- Type names are consistent across tasks: `CircuitState`, `CircuitEvent`,
  `Cue`, `Workout`, `Exercise`, `StreakState`, and the exercise ids in
  `exercises.ts` match those in `gen-voice.sh` and the placeholder-art loop
  in Task 10.
