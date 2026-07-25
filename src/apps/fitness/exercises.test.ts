import { describe, it, expect } from 'vitest';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { EXERCISES, WORKOUTS, getWorkout, getExercise } from './exercises';
import { fitnessAppSchema } from '../../shared/schemas/app.fitness';

// Repo-root-relative, independent of cwd: this file lives at
// src/apps/fitness/exercises.test.ts, so public/ is three levels up.
const publicFitnessDir = fileURLToPath(new URL('../../../public/fitness/', import.meta.url));

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

describe('asset coherence', () => {
  // An exercise id doubles as its art asset and voice clip key (see the
  // Exercise.id doc comment in exercises.ts). Nothing type-checks that
  // relationship, so an exercise added without matching assets would 404
  // silently at runtime instead of failing here.
  it('every exercise has a matching art asset', () => {
    for (const e of EXERCISES) {
      expect(existsSync(`${publicFitnessDir}${e.id}.png`), `missing art asset for ${e.id}`).toBe(true);
    }
  });

  it('every exercise has a matching voice clip', () => {
    for (const e of EXERCISES) {
      expect(existsSync(`${publicFitnessDir}voice/${e.id}.m4a`), `missing voice clip for ${e.id}`).toBe(true);
    }
  });

  it('has the neutral placeholder art', () => {
    expect(existsSync(`${publicFitnessDir}neutral.png`)).toBe(true);
  });
});

describe('config coherence', () => {
  // getWorkout throws on unknown ids, which is only safe because config is
  // validated against this enum first. Drift here reintroduces the crash.
  it('workoutId enum lists exactly the defined workouts', () => {
    const options = fitnessAppSchema.shape.workoutId.unwrap().options;
    expect([...options].sort()).toEqual(WORKOUTS.map((w) => w.id).sort());
  });

  // core and lower only have 4 exercises each, so `rounds: 2` is the
  // deliberate way to lengthen them (see exercises.ts). If this regresses
  // to 1, both workouts silently run at half their intended length.
  it('core and lower workouts are configured for 2 rounds', () => {
    expect(getWorkout('core').rounds).toBe(2);
    expect(getWorkout('lower').rounds).toBe(2);
  });

  // workSeconds/restSeconds/rounds must be optional, not defaulted: a zod
  // `.default()` fires whenever the key is absent from config, which is the
  // normal case for a device where the admin hasn't touched these fields.
  // That default would silently overwrite each workout's own value (e.g.
  // core/lower's `rounds: 2` above) with the schema default instead of
  // leaving it alone. Parsing an empty config must leave these fields
  // `undefined` so FitnessApp's `cfg.rounds ?? base.rounds` fallback can
  // tell "no override" apart from "overridden to the same number".
  it('parsing an empty config leaves workSeconds/restSeconds/rounds undefined', () => {
    const parsed = fitnessAppSchema.parse({});
    expect(parsed.workSeconds).toBeUndefined();
    expect(parsed.restSeconds).toBeUndefined();
    expect(parsed.rounds).toBeUndefined();
  });
});
