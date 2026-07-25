// Pure derivation of what the watchface shows for a given circuit state.
// Split out of FitnessApp so it's covered by Vitest (node-only — nothing
// inside a component is testable) rather than only exercised by hand.

import { getExercise } from './exercises';
import type { Workout } from './exercises';
import { remainingMs, currentExerciseId, nextExerciseId } from './circuit';
import type { CircuitState } from './circuit';

export interface WatchFaceViewModel {
  headline: string;
  caption: string | undefined;
  progress: number;
  artId: string | null;
  artPhase: 'work' | 'rest';
}

function formatSeconds(ms: number): string {
  return String(Math.ceil(ms / 1000));
}

function formatElapsed(ms: number): string {
  const total = Math.round(ms / 1000);
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`;
}

export function deriveViewModel(state: CircuitState, workout: Workout, now: number): WatchFaceViewModel {
  const left = remainingMs(state, now);
  const currentId = currentExerciseId(state, workout);
  const nextId = nextExerciseId(state, workout);

  // `ready` (the state before a first START and after ABORT) has no branch
  // below — it falls through with these defaults: workout name as the
  // headline, a "tap to start" caption, an empty ring, and the neutral pose
  // for the first exercise in the circuit.
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
    // workout.restSeconds is guaranteed > 0 here: afterWork() in circuit.ts
    // short-circuits straight past `rest` into the next work phase whenever
    // restSeconds === 0, so this phase is only ever entered with a positive
    // denominator.
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

  return { headline, caption, progress, artId, artPhase };
}
