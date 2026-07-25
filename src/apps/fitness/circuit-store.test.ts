import { describe, it, expect, beforeEach } from 'vitest';
import { suspendCircuit, takeSuspendedCircuit, clearSuspendedCircuit, SUSPEND_TTL_MS } from './circuit-store';
import { initialState, reduce } from './circuit';
import type { CircuitState } from './circuit';
import { getWorkout } from './exercises';

const W = getWorkout('full-body');
const T0 = 1_700_000_000_000;

/** A `work` state paused 15s into a 30s exercise — the only phase
 * FitnessApp's unmount cleanup ever actually suspends (it pauses first). */
function pausedState(now = T0): CircuitState {
  let s = reduce(initialState(W.id), { type: 'START', workoutId: W.id, now }, W).state;
  s = reduce(s, { type: 'TICK', now: now + 3_000 }, W).state; // countdown -> work
  s = reduce(s, { type: 'PAUSE', now: now + 15_000 }, W).state; // 18s left of a 30s exercise
  return s;
}

function completeState(now = T0): CircuitState {
  return {
    phase: 'complete',
    workoutId: W.id,
    index: 0,
    round: 1,
    phaseEndsAt: now + 20_000,
    resumePhase: null,
    resumeRemainingMs: 0,
    lastCueSecond: null,
    startedAt: now - 60_000,
    finishedAt: now,
  };
}

// The store is module-level state, so every test starts from a clean slate.
beforeEach(() => {
  clearSuspendedCircuit();
});

describe('suspendCircuit / takeSuspendedCircuit', () => {
  it('round-trips a suspended state back out', () => {
    const paused = pausedState();
    suspendCircuit(paused, W.id, T0);
    expect(takeSuspendedCircuit(W.id, T0 + 1_000)).toEqual(paused);
  });

  it('is take-once: a second take returns null', () => {
    const paused = pausedState();
    suspendCircuit(paused, W.id, T0);
    expect(takeSuspendedCircuit(W.id, T0 + 1_000)).toEqual(paused);
    expect(takeSuspendedCircuit(W.id, T0 + 1_000)).toBeNull();
  });

  it('returns null when nothing has been suspended', () => {
    expect(takeSuspendedCircuit(W.id, T0)).toBeNull();
  });

  it('returns null when the saved workout id does not match the requested one', () => {
    suspendCircuit(pausedState(), W.id, T0);
    // Resuming a `core` circuit into a `full-body` workout would index into
    // the wrong exercise list.
    expect(takeSuspendedCircuit('core', T0 + 1_000)).toBeNull();
  });

  it('a mismatched-workout take leaves the entry in place for its actual owner', () => {
    // A device can configure more than one fitness instance
    // (device-config-schema.ts's `instances` array). A mismatch here means
    // "not mine", not "invalid" — some other instance's mount may be the
    // rightful owner and should still be able to claim it.
    const paused = pausedState();
    suspendCircuit(paused, W.id, T0);
    expect(takeSuspendedCircuit('core', T0 + 1_000)).toBeNull();
    expect(takeSuspendedCircuit(W.id, T0 + 2_000)).toEqual(paused);
  });

  it('returns null once the entry is older than SUSPEND_TTL_MS', () => {
    suspendCircuit(pausedState(), W.id, T0);
    expect(takeSuspendedCircuit(W.id, T0 + SUSPEND_TTL_MS + 1)).toBeNull();
  });

  it('still returns the entry exactly at the TTL boundary', () => {
    suspendCircuit(pausedState(), W.id, T0);
    expect(takeSuspendedCircuit(W.id, T0 + SUSPEND_TTL_MS)).not.toBeNull();
  });

  it('returns null for a `ready` phase — nothing worth resuming', () => {
    suspendCircuit(initialState(W.id), W.id, T0);
    expect(takeSuspendedCircuit(W.id, T0 + 1_000)).toBeNull();
  });

  it('returns null for a `complete` phase — nothing worth resuming', () => {
    suspendCircuit(completeState(), W.id, T0);
    expect(takeSuspendedCircuit(W.id, T0 + 1_000)).toBeNull();
  });

  it('pausing before suspending freezes remainingMs — wall-clock time does not leak in', () => {
    const paused = pausedState(); // paused with 18s left of a 30s exercise
    expect(paused.resumeRemainingMs).toBe(18_000);
    expect(paused.phaseEndsAt).toBeNull();

    suspendCircuit(paused, W.id, T0 + 15_000);
    // Take it back 25 minutes later (well within SUSPEND_TTL_MS) — if the
    // store let wall time run instead of relying on the frozen
    // resumeRemainingMs, this would come back wildly different (or the
    // circuit would already read as overdue/complete).
    const takenMuchLater = takeSuspendedCircuit(W.id, T0 + 15_000 + 25 * 60_000);
    expect(takenMuchLater?.resumeRemainingMs).toBe(18_000);
    expect(takenMuchLater?.phaseEndsAt).toBeNull();
  });
});

describe('clearSuspendedCircuit', () => {
  it('clears a suspended entry so it cannot be taken', () => {
    suspendCircuit(pausedState(), W.id, T0);
    clearSuspendedCircuit();
    expect(takeSuspendedCircuit(W.id, T0 + 1_000)).toBeNull();
  });

  it('is safe to call when nothing is suspended', () => {
    expect(() => clearSuspendedCircuit()).not.toThrow();
  });
});
