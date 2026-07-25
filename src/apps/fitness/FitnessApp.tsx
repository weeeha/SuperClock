// Thin shell. All timing, phase transitions and cue decisions live in
// circuit.ts; this component feeds it timestamps, renders the result and
// plays whatever cues it returns.
//
// `dispatch` keeps a ref (`stateRef`) as the reducer's source of truth and
// mirrors it into React state purely for rendering. State updaters must be
// pure, and StrictMode deliberately double-invokes them, so the cue
// playback and streak side effect below live in this handler instead of
// inside `setState`'s updater — a `setState` updater that beeped or called
// `saveStreak` would do both twice under StrictMode, and nesting a second
// `setState` inside the first updater is exactly what React warns against.
// Reading `stateRef.current` (not the closed-over `state`) also means the
// 10Hz tick callback below always reduces from the current phase, not a
// stale one captured at render time.

import { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import type { AppProps } from '../../core/types';
import { useNavigation } from '../../core/navigation';
import { acquireBrightnessLease, releaseBrightnessLease } from '../../core/brightness-lease';
import { fitnessAppSchema } from '../../shared/schemas/app.fitness';
import { getExercise, getWorkout, WORKOUTS } from './exercises';
import type { Workout } from './exercises';
import { initialState, reduce, remainingMs, currentExerciseId, nextExerciseId } from './circuit';
import type { CircuitState, CircuitEvent } from './circuit';
import { useCircuitTimer } from './useCircuitTimer';
import { WorkoutAudio } from './audio';
import { loadStreak, saveStreak, completeWorkout, settleMissedDays, HEARTS_PER_MONTH } from './streak';
import type { StreakState } from './streak';
import WatchFace from './WatchFace';

/** Renew well inside the lease TTL so it never lapses mid-workout. */
const LEASE_RENEW_MS = 30_000;

function formatSeconds(ms: number): string { return String(Math.ceil(ms / 1000)); }

function formatElapsed(ms: number): string {
  const total = Math.round(ms / 1000);
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`;
}

export default function FitnessApp({ isActive, config }: AppProps) {
  // safeParse, not parse: a zod enum only falls back to its default when the
  // key is ABSENT. A stale or hand-edited `workoutId` that isn't in the enum
  // would throw and white-screen the kiosk, so bad config degrades to defaults.
  const cfg = useMemo(() => {
    const parsed = fitnessAppSchema.safeParse(config ?? {});
    return parsed.success ? parsed.data : fitnessAppSchema.parse({});
  }, [config]);

  const [workoutIndex, setWorkoutIndex] = useState(() =>
    Math.max(0, WORKOUTS.findIndex((w) => w.id === cfg.workoutId)),
  );
  // Mirrors workoutIndex so the vertical-swipe callback below — which is
  // only rebuilt when isActive/phase/running change, not on every workout
  // cycle — can read the current index without adding it to that effect's
  // deps (and without a stale-closure risk if it did).
  const workoutIndexRef = useRef(workoutIndex);
  useEffect(() => {
    workoutIndexRef.current = workoutIndex;
  }, [workoutIndex]);

  // Config overrides the workout's built-in durations so the admin can retune
  // without editing code.
  const workout: Workout = useMemo(() => {
    const base = getWorkout(WORKOUTS[workoutIndex].id);
    return { ...base, workSeconds: cfg.workSeconds, restSeconds: cfg.restSeconds, rounds: cfg.rounds };
  }, [workoutIndex, cfg.workSeconds, cfg.restSeconds, cfg.rounds]);

  // Ref and state are seeded independently rather than one from the other
  // (`useState(stateRef.current)`/`useState(streakRef.current)`) because
  // reading a ref's `.current` during render — even just to hand it to
  // useState — trips react-hooks/refs. initialState()/settleMissedDays()
  // are pure, so computing the same value twice at mount is harmless; every
  // update after that keeps the two in lockstep by construction (dispatch
  // and the workout-swipe handler always write both together).
  const stateRef = useRef<CircuitState>(initialState(workout.id));
  const [state, setState] = useState<CircuitState>(() => initialState(workout.id));

  const [now, setNow] = useState(() => Date.now());

  const streakRef = useRef<StreakState>(settleMissedDays(loadStreak(), new Date()));
  const [streak, setStreak] = useState<StreakState>(() => settleMissedDays(loadStreak(), new Date()));

  const setVerticalSwipeCallback = useNavigation((s) => s.setVerticalSwipeCallback);
  const showGrid = useNavigation((s) => s.showGrid);

  const audio = useRef<WorkoutAudio | null>(null);
  if (audio.current === null) {
    audio.current = new WorkoutAudio({ beeps: cfg.beeps, voice: cfg.voiceCues });
  }

  const running = state.phase === 'countdown' || state.phase === 'work' || state.phase === 'rest';

  const dispatch = useCallback((event: CircuitEvent) => {
    const prev = stateRef.current;
    const { state: next, cues } = reduce(prev, event, workout);
    if (next !== prev) {
      stateRef.current = next;
      setState(next);
    }
    for (const cue of cues) audio.current?.play(cue);
    if (prev.phase !== 'complete' && next.phase === 'complete') {
      const updated = completeWorkout(streakRef.current, new Date());
      streakRef.current = updated;
      setStreak(updated);
      saveStreak(updated);
    }
  }, [workout]);

  useCircuitTimer(isActive, (t) => {
    setNow(t);
    dispatch({ type: 'TICK', now: t });
  });

  // Swiping to another app must pause, not abandon — position is preserved
  // so swiping back resumes mid-exercise.
  useEffect(() => {
    if (!isActive && running) dispatch({ type: 'PAUSE', now: Date.now() });
  }, [isActive, running, dispatch]);

  // Hold the screen at full brightness while a circuit runs, unless the
  // admin has turned that override off for this instance.
  useEffect(() => {
    if (!running || !cfg.keepBright) return;
    acquireBrightnessLease();
    const timer = window.setInterval(() => acquireBrightnessLease(), LEASE_RENEW_MS);
    return () => { window.clearInterval(timer); releaseBrightnessLease(); };
  }, [running, cfg.keepBright]);

  useEffect(() => () => audio.current?.dispose(), []);

  useEffect(() => {
    if (!isActive) { setVerticalSwipeCallback(null); return; }
    setVerticalSwipeCallback((dir) => {
      if (dir === 'down') { showGrid(); return; }
      if (state.phase === 'ready') {
        // Cycling the workout while idle must also reset the circuit to a
        // clean state for the newly selected workout, not just point the
        // index at it — otherwise stateRef/state keep holding the previous
        // workout's id. This lives here, in the swipe handler, rather than
        // an effect keyed on `workout`/workoutIndex: `workout` is a new
        // object on every cfg change too (admin retuning
        // workSeconds/restSeconds/rounds), and an effect that reset on any
        // such change would wipe an in-progress circuit the moment the
        // admin pushed a config update mid-workout. Doing the reset only in
        // response to the explicit "swipe while ready" gesture keeps it
        // scoped to the one case that should reset.
        const nextIndex = (workoutIndexRef.current + 1) % WORKOUTS.length;
        setWorkoutIndex(nextIndex);
        const fresh = initialState(WORKOUTS[nextIndex].id);
        stateRef.current = fresh;
        setState(fresh);
      } else if (state.phase === 'paused') {
        dispatch({ type: 'ABORT', now: Date.now() });
      } else if (running) {
        dispatch({ type: 'SKIP', now: Date.now() });
      }
    });
    return () => setVerticalSwipeCallback(null);
  }, [isActive, state.phase, running, setVerticalSwipeCallback, showGrid, dispatch]);

  function handleTap(): void {
    const t = Date.now();
    if (state.phase === 'ready') {
      audio.current?.preload(workout.exerciseIds);
      dispatch({ type: 'START', workoutId: workout.id, now: t });
    } else if (state.phase === 'paused') dispatch({ type: 'RESUME', now: t });
    else if (state.phase === 'complete') dispatch({ type: 'ABORT', now: t });
    else dispatch({ type: 'PAUSE', now: t });
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
