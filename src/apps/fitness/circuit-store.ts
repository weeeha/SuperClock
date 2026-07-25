// Circuit state that must outlive a FitnessApp mount. SwipeContainer keys its
// child on the active app/instance id, so swiping to a DIFFERENT app (or
// playlist auto-rotation via switchToInstance) unmounts FitnessApp outright
// rather than deactivating it — a plain useState would discard an
// in-progress workout the instant that happens. This module is the survivor:
// FitnessApp's unmount cleanup suspends a paused circuit here, and the next
// mount takes it back out (once) if it still applies.
//
// Module-level value + listener set, the same shape as
// src/core/brightness-lease.ts.
//
// Free of window/DOM so it stays testable in the node Vitest environment.

import type { CircuitState } from './circuit';

/** Coming back a day later and finding yourself paused at exercise 4 is
 *  confusing, not helpful — so a suspended circuit expires. */
export const SUSPEND_TTL_MS = 30 * 60_000;

interface SuspendedCircuit {
  state: CircuitState;
  workoutId: string;
  savedAt: number;
}

let suspended: SuspendedCircuit | null = null;
const listeners = new Set<() => void>();

function emit(): void {
  for (const fn of listeners) fn();
}

/** Save `state` for later resumption. Overwrites whatever was previously
 * suspended — there is only ever one in-flight circuit. */
export function suspendCircuit(state: CircuitState, workoutId: string, now: number): void {
  suspended = { state, workoutId, savedAt: now };
  emit();
}

/**
 * Take-once: when the saved entry matches `workoutId`, returns it and clears
 * it immediately, so it can never be resurrected twice (e.g. re-mounting
 * after the first take already consumed it).
 *
 * Returns null when:
 * - nothing is suspended;
 * - the saved workout doesn't match `workoutId` (resuming a `core` circuit
 *   into a `full-body` workout would index into the wrong exercise list) —
 *   the entry is left untouched in this case, since a device can configure
 *   more than one fitness instance (`device-config-schema.ts`'s
 *   `instances` array) and a mismatch here just means "not mine", not
 *   "invalid": some other instance may still be the rightful owner and
 *   claim it on its own mount;
 * - the entry is older than SUSPEND_TTL_MS;
 * - the saved phase is `ready` or `complete` — nothing worth resuming.
 * The latter two are only checked (and only clear the entry) once the
 * workout id has already matched — at that point the entry is unambiguously
 * this call's to consume, whether or not it turns out to be resumable.
 */
export function takeSuspendedCircuit(workoutId: string, now: number): CircuitState | null {
  const entry = suspended;
  if (entry === null) return null;
  if (entry.workoutId !== workoutId) return null;

  // From here on the entry belongs to this call: consume it regardless of
  // whether the checks below end up accepting or rejecting it.
  suspended = null;
  emit();

  if (now - entry.savedAt > SUSPEND_TTL_MS) return null;
  if (entry.state.phase === 'ready' || entry.state.phase === 'complete') return null;
  return entry.state;
}

export function clearSuspendedCircuit(): void {
  suspended = null;
  emit();
}

export function subscribeSuspendedCircuit(onChange: () => void): () => void {
  listeners.add(onChange);
  return () => listeners.delete(onChange);
}
