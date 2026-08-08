// A running workout must not be dimmed by the night-mode schedule. Because
// useApplySettings applies `filter: brightness()` to <html>, an app cannot
// opt out from inside its own subtree — the override has to be consulted at
// the point the filter is set.
//
// The lease is an expiry timestamp rather than a boolean so a crashed or
// navigated-away kiosk reverts on its own, the same guard the radar mode
// lease uses server-side.

import { useSyncExternalStore } from 'react';

/** Auto-expiry. Renewed while a circuit runs; longer than any one workout. */
export const LEASE_TTL_MS = 90_000;

let expiresAt = 0;
const listeners = new Set<() => void>();

function emit(): void {
  for (const fn of listeners) fn();
}

/** Take or renew the lease. Callers must renew well inside LEASE_TTL_MS. */
export function acquireBrightnessLease(now: number = Date.now()): void {
  expiresAt = now + LEASE_TTL_MS;
  emit();
}

export function releaseBrightnessLease(): void {
  expiresAt = 0;
  emit();
}

export function isBrightnessLeased(now: number = Date.now()): boolean {
  return now < expiresAt;
}

function subscribe(onChange: () => void): () => void {
  listeners.add(onChange);
  // Re-check on a timer too: expiry is a clock event, not a mutation, so
  // nothing would otherwise notify React when the lease lapses.
  const timer = window.setInterval(onChange, 5_000);
  return () => {
    listeners.delete(onChange);
    window.clearInterval(timer);
  };
}

export function useBrightnessLease(): boolean {
  return useSyncExternalStore(subscribe, () => isBrightnessLeased(), () => false);
}
