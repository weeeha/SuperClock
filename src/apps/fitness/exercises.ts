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
  targets: Target;
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
  { id: 'push-ups',          name: 'Push-ups',          targets: 'upper' },
  { id: 'squats',            name: 'Squats',            targets: 'lower' },
  { id: 'crunches',          name: 'Crunches',          targets: 'core'  },
  { id: 'bench-dips',        name: 'Bench Dips',        targets: 'upper' },
  { id: 'lunges',            name: 'Lunges',            targets: 'lower' },
  { id: 'plank',             name: 'Plank',             targets: 'core'  },
  { id: 'shoulder-taps',     name: 'Shoulder Taps',     targets: 'upper' },
  { id: 'jumping-jacks',     name: 'Jumping Jacks',     targets: 'lower' },
  { id: 'mountain-climbers', name: 'Mountain Climbers', targets: 'core'  },
  { id: 'push-up-rotation',  name: 'Push-up & Rotation', targets: 'upper' },
  { id: 'high-knees',        name: 'High Knees',        targets: 'lower' },
  { id: 'side-plank',        name: 'Side Plank',        targets: 'core'  },
];

function idsFor(target: Target): string[] {
  return EXERCISES.filter((e) => e.targets === target).map((e) => e.id);
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
