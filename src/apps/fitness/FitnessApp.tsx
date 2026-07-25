// Thin shell: wiring plus JSX. Timing and phase transitions live in
// circuit.ts, presentation derivation lives in view-model.ts; this
// component feeds timestamps into the reducer, plays whatever cues it
// returns, and renders the derived view model through WatchFace.
//
// `dispatch` keeps a ref (`stateRef`) as the reducer's source of truth and
// mirrors it into React state purely for rendering. State updaters must be
// pure, and StrictMode deliberately double-invokes them, so the cue
// playback below lives in this handler instead of inside `setState`'s
// updater — an updater that beeped would do so twice under StrictMode.
// Reading `stateRef.current` (not the closed-over `state`) also means the
// 10Hz tick callback below always reduces from the current phase, not a
// stale one captured at render time.

import { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import type { AppProps } from '../../core/types';
import { useNavigation } from '../../core/navigation';
import { acquireBrightnessLease, releaseBrightnessLease } from '../../core/brightness-lease';
import { fitnessAppSchema } from '../../shared/schemas/app.fitness';
import { getWorkout, WORKOUTS } from './exercises';
import type { Workout } from './exercises';
import { initialState, reduce } from './circuit';
import type { CircuitState, CircuitEvent } from './circuit';
import { useCircuitTimer } from './useCircuitTimer';
import { WorkoutAudio } from './audio';
import { loadStreak, saveStreak, completeWorkout, settleMissedDays, toDateKey, HEARTS_PER_MONTH } from './streak';
import { deriveViewModel } from './view-model';
import WatchFace from './WatchFace';

/** Renew well inside the lease TTL so it never lapses mid-workout. */
const LEASE_RENEW_MS = 30_000;

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

  // Config overrides the workout's built-in durations so the admin can retune
  // without editing code.
  const workout: Workout = useMemo(() => {
    const base = getWorkout(WORKOUTS[workoutIndex].id);
    return {
      ...base,
      workSeconds: cfg.workSeconds ?? base.workSeconds,
      restSeconds: cfg.restSeconds ?? base.restSeconds,
      rounds: cfg.rounds ?? base.rounds,
    };
  }, [workoutIndex, cfg.workSeconds, cfg.restSeconds, cfg.rounds]);

  // Ref and state are seeded independently rather than one from the other
  // (`useState(stateRef.current)`) because reading a ref's `.current`
  // during render — even just to hand it to useState — trips
  // react-hooks/refs. initialState() is pure, so computing the same value
  // twice at mount is harmless; every update after that keeps the two in
  // lockstep by construction (dispatch and the workout-swipe handler always
  // write both together).
  const stateRef = useRef<CircuitState>(initialState(workout.id));
  const [state, setState] = useState<CircuitState>(() => initialState(workout.id));

  const [now, setNow] = useState(() => Date.now());

  // No ref mirror here (unlike stateRef above): a functional setState
  // update gets a guaranteed-fresh `prev` from React itself, so there's no
  // stale-read hazard to guard against, and persistence moves to its own
  // effect below instead of running inside the updater.
  const [streak, setStreak] = useState(() => settleMissedDays(loadStreak(), new Date()));
  useEffect(() => {
    saveStreak(streak);
  }, [streak]);

  // Re-settle on day rollover, not just at mount: a kiosk can sit on this
  // screen for weeks, and settleMissedDays' header comment promises a
  // periodic recheck so missed-day hearts decrement at midnight even
  // without a workout completing. `settledThroughKey` (already part of
  // StreakState) doubles as the "did the day actually change" gate, so the
  // functional updater returns the same `prev` reference — and React skips
  // the re-render — on every poll that isn't a rollover.
  useEffect(() => {
    if (!isActive) return;
    const id = window.setInterval(() => {
      const now = new Date();
      setStreak((prev) => (prev.settledThroughKey === toDateKey(now) ? prev : settleMissedDays(prev, now)));
    }, 30_000);
    return () => window.clearInterval(id);
  }, [isActive]);

  const setVerticalSwipeCallback = useNavigation((s) => s.setVerticalSwipeCallback);
  const showGrid = useNavigation((s) => s.showGrid);

  const audio = useRef<WorkoutAudio | null>(null);
  if (audio.current === null) {
    audio.current = new WorkoutAudio({ beeps: cfg.beeps, voice: cfg.voiceCues });
  }
  // The instance above is constructed once and lives for the app's mount
  // lifetime (kiosk apps stay mounted indefinitely), so a later config poll
  // that flips beeps/voiceCues has to reach the existing instance — the
  // constructor args were only ever a snapshot of whatever cfg was at
  // mount.
  useEffect(() => {
    audio.current?.setOptions({ beeps: cfg.beeps, voice: cfg.voiceCues });
  }, [cfg.beeps, cfg.voiceCues]);

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
      setStreak((prevStreak) => completeWorkout(prevStreak, new Date()));
    }
  }, [workout]);

  useCircuitTimer(isActive, (t) => {
    setNow(t);
    dispatch({ type: 'TICK', now: t });
  });

  // Pauses a running circuit when the app grid opens over it.
  //
  // That is the ONLY case this covers. SwipeContainer passes
  // `isActive={mode !== 'grid'}` and keys its child on the active app id, so
  // swiping to a DIFFERENT app changes the key and unmounts this component
  // outright — it never re-renders with isActive:false, and the circuit is
  // discarded rather than paused. Playlist auto-rotation (core/playlist.ts)
  // does the same thing, so a rotating kiosk can never finish a workout.
  //
  // Making swipe-away resumable requires circuit state to outlive the mount;
  // see "Known limitation" in the design doc.
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

  // Dev-only handle for stepping the circuit by hand, mirroring `window.__nav`.
  // Two places need it: the Pi has no attachable debugger, and Claude's preview
  // tab is permanently backgrounded — Chromium suspends rAF entirely in a hidden
  // tab, so `useCircuitTimer` never fires there and the circuit cannot otherwise
  // be advanced. Stripped from production builds by the `import.meta.env.DEV`
  // guard.
  useEffect(() => {
    if (!import.meta.env.DEV) return;
    const w = window as unknown as { __fitness?: unknown };
    w.__fitness = {
      // Advances the display clock alongside the reducer, exactly as the real
      // tick callback does — otherwise the rendered countdown is derived from
      // a `now` frozen at mount and shows nonsense.
      dispatch: (event: CircuitEvent) => {
        if ('now' in event) setNow(event.now);
        dispatch(event);
      },
      getState: () => stateRef.current,
    };
    return () => { delete w.__fitness; };
  }, [dispatch]);

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
        const nextIndex = (workoutIndex + 1) % WORKOUTS.length;
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
  }, [isActive, state.phase, running, workoutIndex, setVerticalSwipeCallback, showGrid, dispatch]);

  function handleTap(): void {
    const t = Date.now();
    if (state.phase === 'ready') {
      audio.current?.preload(workout.exerciseIds);
      dispatch({ type: 'START', workoutId: workout.id, now: t });
    } else if (state.phase === 'paused') dispatch({ type: 'RESUME', now: t });
    else if (state.phase === 'complete') dispatch({ type: 'ABORT', now: t });
    else dispatch({ type: 'PAUSE', now: t });
  }

  const vm = deriveViewModel(state, workout, now);

  return (
    <div className="h-full w-full" onClick={handleTap}>
      <WatchFace
        progress={vm.progress}
        headline={vm.headline}
        caption={vm.caption}
        heartsTotal={HEARTS_PER_MONTH}
        heartsLeft={streak.hearts}
        exerciseId={vm.artId}
        artPhase={vm.artPhase}
        playing={state.phase !== 'paused'}
        inverted={state.phase === 'rest'}
      />
    </div>
  );
}
