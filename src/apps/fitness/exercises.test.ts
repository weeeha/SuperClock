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
    const targets = workout.exerciseIds.map((id) => getExercise(id).targets);
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
