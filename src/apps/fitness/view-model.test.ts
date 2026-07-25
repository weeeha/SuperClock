import { describe, it, expect } from 'vitest';
import { deriveViewModel } from './view-model';
import { initialState, reduce } from './circuit';
import type { CircuitState } from './circuit';
import { getWorkout, getExercise } from './exercises';
import type { Workout } from './exercises';

const W = getWorkout('full-body');
const T0 = 1_700_000_000_000;

/** A tiny custom workout (real exercise ids, short durations) so
 *  rest/complete can be reached in a couple of ticks instead of walking
 *  full-body's whole 12-exercise circuit. */
const SHORT: Workout = {
  id: 'short',
  name: 'Short',
  exerciseIds: ['push-ups', 'squats'],
  workSeconds: 5,
  restSeconds: 10,
  rounds: 1,
};

function tick(state: CircuitState, now: number, workout: Workout): CircuitState {
  return reduce(state, { type: 'TICK', now }, workout).state;
}

function expectValidProgress(progress: number): void {
  expect(progress).toBeGreaterThanOrEqual(0);
  expect(progress).toBeLessThanOrEqual(1);
}

describe('deriveViewModel', () => {
  it('ready: falls through to the pre-loop defaults', () => {
    const vm = deriveViewModel(initialState(W.id), W, T0);
    expect(vm.headline).toBe(W.name.toUpperCase());
    expect(vm.caption).toBe('tap to start');
    expect(vm.progress).toBe(0);
    expect(vm.artId).toBe(W.exerciseIds[0]);
    expect(vm.artPhase).toBe('work');
    expectValidProgress(vm.progress);
  });

  it('countdown: shows a whole-second headline and hides the art', () => {
    const started = reduce(initialState(W.id), { type: 'START', workoutId: W.id, now: T0 }, W).state;
    const vm = deriveViewModel(started, W, T0 + 500);
    expect(vm.headline).toBe('3'); // 2500ms left, ceil'd
    expect(vm.caption).toBe(`get ready · ${getExercise(W.exerciseIds[0]).name}`);
    expect(vm.artId).toBeNull();
    expectValidProgress(vm.progress);
  });

  it('work: progress climbs from 0 towards 1 and shows the exercise name', () => {
    let s = reduce(initialState(SHORT.id), { type: 'START', workoutId: SHORT.id, now: T0 }, SHORT).state;
    s = tick(s, s.phaseEndsAt!, SHORT); // countdown → work
    expect(s.phase).toBe('work');

    const atStart = deriveViewModel(s, SHORT, s.phaseEndsAt! - SHORT.workSeconds * 1000);
    expect(atStart.progress).toBe(0);
    expect(atStart.caption).toBe(getExercise('push-ups').name);
    expectValidProgress(atStart.progress);

    const midway = deriveViewModel(s, SHORT, s.phaseEndsAt! - (SHORT.workSeconds * 1000) / 2);
    expect(midway.progress).toBeCloseTo(0.5, 1);
    expectValidProgress(midway.progress);

    const atEnd = deriveViewModel(s, SHORT, s.phaseEndsAt!);
    expect(atEnd.progress).toBe(1);
    expectValidProgress(atEnd.progress);
  });

  it('rest: names the next exercise and its progress is bounded', () => {
    let s = reduce(initialState(SHORT.id), { type: 'START', workoutId: SHORT.id, now: T0 }, SHORT).state;
    s = tick(s, s.phaseEndsAt!, SHORT); // → work
    s = tick(s, s.phaseEndsAt!, SHORT); // → rest
    expect(s.phase).toBe('rest');

    const vm = deriveViewModel(s, SHORT, s.phaseEndsAt! - SHORT.restSeconds * 500);
    expect(vm.caption).toBe(`next · ${getExercise('squats').name}`);
    expect(vm.artPhase).toBe('rest');
    expectValidProgress(vm.progress);
  });

  it('paused: freezes on the interrupted exercise and remembers which phase to resume into', () => {
    let s = reduce(initialState(SHORT.id), { type: 'START', workoutId: SHORT.id, now: T0 }, SHORT).state;
    s = tick(s, s.phaseEndsAt!, SHORT); // → work
    const paused = reduce(s, { type: 'PAUSE', now: s.phaseEndsAt! - 2_000 }, SHORT).state;
    expect(paused.phase).toBe('paused');

    const vm = deriveViewModel(paused, SHORT, T0 + 999_999);
    expect(vm.headline).toBe('❚❚');
    expect(vm.caption).toBe(`1 of ${SHORT.exerciseIds.length} · ${getExercise('push-ups').name}`);
    expect(vm.artPhase).toBe('work');
    expectValidProgress(vm.progress);
  });

  it('complete: shows the elapsed time as M:SS and a full ring', () => {
    let s = reduce(initialState(SHORT.id), { type: 'START', workoutId: SHORT.id, now: T0 }, SHORT).state;
    s = tick(s, s.phaseEndsAt!, SHORT); // → work (push-ups)
    s = tick(s, s.phaseEndsAt!, SHORT); // → rest
    s = tick(s, s.phaseEndsAt!, SHORT); // → work (squats)
    s = tick(s, s.phaseEndsAt!, SHORT); // → complete
    expect(s.phase).toBe('complete');

    // startedAt = T0, finishedAt = countdown + work + rest + work later.
    const elapsedMs = s.finishedAt! - s.startedAt!;
    const expectedSeconds = Math.round(elapsedMs / 1000);
    const expectedLabel = `${Math.floor(expectedSeconds / 60)}:${String(expectedSeconds % 60).padStart(2, '0')}`;

    const vm = deriveViewModel(s, SHORT, s.finishedAt!);
    expect(vm.headline).toBe(expectedLabel);
    expect(vm.headline).toMatch(/^\d+:\d{2}$/);
    expect(vm.caption).toBe('well done');
    expect(vm.progress).toBe(1);
    expect(vm.artPhase).toBe('rest');
    expectValidProgress(vm.progress);
  });
});
