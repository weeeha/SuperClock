import { describe, it, expect } from 'vitest';
import { initialState, reduce, remainingMs, COUNTDOWN_MS, COMPLETE_LINGER_MS } from './circuit';
import { getWorkout } from './exercises';
import type { CircuitState } from './circuit';

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
