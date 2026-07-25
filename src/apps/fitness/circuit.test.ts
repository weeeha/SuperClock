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

  it('from ready is a no-op', () => {
    const ready = initialState('full-body');
    expect(reduce(ready, { type: 'PAUSE', now: T0 }, W).state).toEqual(ready);
  });

  it('RESUME when not paused is a no-op', () => {
    const s = intoWork();
    const resumed = reduce(s, { type: 'RESUME', now: T0 + 999_999 }, W).state;
    expect(resumed).toEqual(s);
  });
});

describe('skip', () => {
  it('during countdown goes straight to work, anchored off the skip moment', () => {
    const started = reduce(initialState('full-body'), { type: 'START', workoutId: 'full-body', now: T0 }, W).state;
    const skipNow = T0 + 1_200;
    const skipped = reduce(started, { type: 'SKIP', now: skipNow }, W).state;
    expect(skipped.phase).toBe('work');
    expect(skipped.phaseEndsAt).toBe(skipNow + W.workSeconds * 1000);
  });

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

  it('from paused is a no-op', () => {
    let s = reduce(initialState('full-body'), { type: 'START', workoutId: 'full-body', now: T0 }, W).state;
    s = tick(s, T0 + COUNTDOWN_MS);
    const paused = reduce(s, { type: 'PAUSE', now: T0 + COUNTDOWN_MS + 1_000 }, W).state;
    const skipped = reduce(paused, { type: 'SKIP', now: T0 + COUNTDOWN_MS + 5_000 }, W).state;
    expect(skipped).toEqual(paused);
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
    // Work through every exercise of round 1: work→rest for each of the
    // core.exerciseIds.length exercises, then one more tick rolls the
    // trailing rest over into round 2's first work phase.
    for (let i = 0; i < core.exerciseIds.length * 2; i++) {
      s = reduce(s, { type: 'TICK', now: s.phaseEndsAt! }, core).state;
    }
    expect(s.round).toBe(2);
    expect(s.index).toBe(0);
    expect(s.phase).toBe('work');
  });
});

describe('anchor invariant', () => {
  // Guards the ~1.7s accumulated-drift bug: a late TICK (e.g. the app was
  // backgrounded) must anchor the next phase off the *ideal* previous
  // boundary (state.phaseEndsAt), never off the late observed `now`.
  it('anchors the phase after a late tick off the ideal boundary, not the late now', () => {
    let s = reduce(initialState('full-body'), { type: 'START', workoutId: 'full-body', now: T0 }, W).state;
    s = tick(s, T0 + COUNTDOWN_MS); // → work, index 0
    const idealWorkEnd = s.phaseEndsAt!;
    const lateNow = idealWorkEnd + 45_000; // delivered 45s late

    const rested = reduce(s, { type: 'TICK', now: lateNow }, W).state;

    expect(rested.phase).toBe('rest');
    expect(rested.phaseEndsAt).toBe(idealWorkEnd + W.restSeconds * 1000);
    expect(rested.phaseEndsAt).not.toBe(lateNow + W.restSeconds * 1000);
  });

  it('restSeconds: 0 skips rest entirely, landing directly in the next work phase', () => {
    const zeroRest = {
      id: 'zero-rest',
      name: 'Zero Rest',
      exerciseIds: ['push-ups', 'squats'],
      workSeconds: 20,
      restSeconds: 0,
      rounds: 1,
    };
    let s = reduce(initialState('zero-rest'), { type: 'START', workoutId: 'zero-rest', now: T0 }, zeroRest).state;
    s = reduce(s, { type: 'TICK', now: T0 + COUNTDOWN_MS }, zeroRest).state; // → work, index 0
    const workEnd = s.phaseEndsAt!;
    s = reduce(s, { type: 'TICK', now: workEnd }, zeroRest).state;

    expect(s.phase).toBe('work');
    expect(s.index).toBe(1);
    expect(s.phaseEndsAt).toBe(workEnd + zeroRest.workSeconds * 1000);
  });
});

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
