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

// `anchor` is the timestamp the new phase's duration is measured from. For a
// natural (TICK-driven) expiry it must be the *previous* phase's ideal
// `phaseEndsAt`, not the actual tick time — ticks can land up to one tick
// interval late, and anchoring off the observed `now` instead of the ideal
// boundary would let that lag accumulate across every transition in the
// circuit. `now` is the real observed time, used only for point-in-time
// facts (`finishedAt`) that should reflect when a transition was actually
// detected rather than the ideal schedule.

function enterWork(state: CircuitState, workout: Workout, anchor: number): CircuitResult {
  return {
    state: {
      ...state,
      phase: 'work',
      phaseEndsAt: anchor + workout.workSeconds * 1000,
      lastCueSecond: null,
    },
    cues: [
      { kind: 'beep', tone: 'work' },
      { kind: 'voice', id: currentExerciseId(state, workout) },
    ],
  };
}

function enterComplete(state: CircuitState, anchor: number, now: number): CircuitResult {
  return {
    state: {
      ...state,
      phase: 'complete',
      phaseEndsAt: anchor + COMPLETE_LINGER_MS,
      finishedAt: now,
      lastCueSecond: null,
    },
    cues: [{ kind: 'beep', tone: 'finish' }],
  };
}

/** Work has ended: rest, or finish if that was the last exercise. */
function afterWork(state: CircuitState, workout: Workout, anchor: number, now: number): CircuitResult {
  if (isLastExercise(state, workout)) return enterComplete(state, anchor, now);
  if (workout.restSeconds === 0) return afterRest(state, workout, anchor);
  return {
    state: { ...state, phase: 'rest', phaseEndsAt: anchor + workout.restSeconds * 1000, lastCueSecond: null },
    cues: [
      { kind: 'beep', tone: 'rest' },
      { kind: 'voice', id: nextExerciseId(state, workout)! },
    ],
  };
}

/** Rest has ended: advance to the next exercise, rolling the round over. */
function afterRest(state: CircuitState, workout: Workout, anchor: number): CircuitResult {
  const atEndOfRound = state.index + 1 >= workout.exerciseIds.length;
  const advanced: CircuitState = atEndOfRound
    ? { ...state, index: 0, round: state.round + 1 }
    : { ...state, index: state.index + 1 };
  return enterWork(advanced, workout, anchor);
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

      // Anchor the next phase's boundary off the ideal previous boundary
      // (state.phaseEndsAt), not the possibly-late event.now — see the note
      // above enterWork. `now` is passed through separately for finishedAt.
      switch (state.phase) {
        case 'countdown': return enterWork(state, workout, state.phaseEndsAt);
        case 'work':      return afterWork(state, workout, state.phaseEndsAt, event.now);
        case 'rest':      return afterRest(state, workout, state.phaseEndsAt);
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
      // A skip is a real user action taken before natural expiry, so the
      // next phase is anchored off the actual moment of the skip.
      switch (state.phase) {
        case 'countdown': return enterWork(state, workout, event.now);
        case 'work':      return afterWork(state, workout, event.now, event.now);
        case 'rest':      return afterRest(state, workout, event.now);
        default:          return { state, cues: [] };
      }
    }

    case 'ABORT':
      return { state: initialState(state.workoutId), cues: [] };
  }
}
