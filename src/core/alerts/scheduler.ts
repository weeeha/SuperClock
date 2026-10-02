// One clock for every alert boundary: when the earliest scheduled alert fires,
// and when a ringing one settles. The board's deliberate exception to "only
// tick while active" — a background alert that dies with its app is useless —
// kept to a single timeout, with no re-render between boundaries.
import { useEffect, useState } from 'react';
import { RING_MS, useAlerts, type RingingAlert, type ScheduledAlert } from './alert-store';

/** setTimeout's ceiling; longer waits simply re-plan when it elapses. */
export const MAX_TIMEOUT_MS = 2 ** 31 - 1;

export type Plan =
  | { kind: 'idle' }
  | { kind: 'fire'; alert: ScheduledAlert }
  | { kind: 'settle' }
  | { kind: 'wait'; ms: number };

export function planNext(scheduled: ScheduledAlert[], ringing: RingingAlert | null, now: number): Plan {
  if (ringing) {
    if (ringing.settled) return { kind: 'idle' }; // the queue waits for dismiss
    const settleAt = ringing.firedAt + RING_MS;
    return settleAt <= now ? { kind: 'settle' } : { kind: 'wait', ms: Math.min(settleAt - now, MAX_TIMEOUT_MS) };
  }
  if (scheduled.length === 0) return { kind: 'idle' };
  const earliest = scheduled.reduce((x, y) => (y.firesAt < x.firesAt ? y : x));
  if (earliest.firesAt <= now) return { kind: 'fire', alert: earliest };
  return { kind: 'wait', ms: Math.min(earliest.firesAt - now, MAX_TIMEOUT_MS) };
}

/** Mount once, in App. */
export function useAlertScheduler(): void {
  const scheduled = useAlerts((s) => s.scheduled);
  const ringing = useAlerts((s) => s.ringing);
  const [wake, setWake] = useState(0);

  useEffect(() => {
    const plan = planNext(scheduled, ringing, Date.now());
    if (plan.kind === 'fire') {
      // Its true firedAt, so an alert that came due during a restart rings only
      // for what is left of its window.
      useAlerts.getState().fire(plan.alert.id, plan.alert.firesAt);
      return;
    }
    if (plan.kind === 'settle') {
      useAlerts.getState().settle();
      return;
    }
    if (plan.kind === 'idle') return;
    const id = setTimeout(() => setWake((w) => w + 1), plan.ms);
    return () => clearTimeout(id);
  }, [scheduled, ringing, wake]);

  useEffect(() => {
    const onVisible = () => {
      if (!document.hidden) setWake((w) => w + 1);
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => document.removeEventListener('visibilitychange', onVisible);
  }, []);
}
