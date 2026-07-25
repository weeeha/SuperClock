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

// These throw rather than returning `T | undefined` like getApp/getFace do.
// Those registries hold dynamically registered entries where a miss is a real
// runtime state; EXERCISES and WORKOUTS are a hand-authored constant in this
// same file, so an unknown id is a programming error and every call site would
// otherwise carry a null check that can never fire.
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
