// One clock for every alert boundary: when the earliest scheduled alert fires,
// when a lead window starts, and when a ringing alert settles. The board's
// deliberate exception to "only tick while active", kept to a single timeout.
import { useEffect, useState } from 'react';
import { RING_MS, useAlerts, type RingingAlert, type ScheduledAlert } from './alert-store';

/** setTimeout's ceiling; longer waits simply re-plan when it elapses. */
export const MAX_TIMEOUT_MS = 2 ** 31 - 1;

export type Plan =
  | { kind: 'idle' }
  | { kind: 'fire'; alert: ScheduledAlert }
  | { kind: 'settle' }
  | { kind: 'wait'; ms: number };

/** The earliest scheduled alert whose lead window contains `now`. */
export function leadCandidate(scheduled: ScheduledAlert[], now: number): ScheduledAlert | null {
  let best: ScheduledAlert | null = null;
  for (const a of scheduled) {
    if (!a.leadMs || a.firesAt <= now || a.firesAt - a.leadMs > now) continue;
    if (!best || a.firesAt < best.firesAt) best = a;
  }
  return best;
}

export function planNext(scheduled: ScheduledAlert[], ringing: RingingAlert | null, now: number): Plan {
  if (ringing) {
    if (ringing.settled) return { kind: 'idle' }; // the queue waits for dismiss
    const settleAt = ringing.firedAt + (ringing.ringMs ?? RING_MS);
    return settleAt <= now ? { kind: 'settle' } : { kind: 'wait', ms: Math.min(settleAt - now, MAX_TIMEOUT_MS) };
  }
  if (scheduled.length === 0) return { kind: 'idle' };
  const earliest = scheduled.reduce((x, y) => (y.firesAt < x.firesAt ? y : x));
  if (earliest.firesAt <= now) return { kind: 'fire', alert: earliest };
  // The next boundary is the earliest fire time or lead start still ahead.
  let next = earliest.firesAt;
  for (const a of scheduled) {
    if (!a.leadMs) continue;
    const leadStart = a.firesAt - a.leadMs;
    if (leadStart > now && leadStart < next) next = leadStart;
  }
  return { kind: 'wait', ms: Math.min(next - now, MAX_TIMEOUT_MS) };
}

/** Mount once, in App. */
export function useAlertScheduler(): void {
  const scheduled = useAlerts((s) => s.scheduled);
  const ringing = useAlerts((s) => s.ringing);
  const [wake, setWake] = useState(0);

  useEffect(() => {
    const now = Date.now();
    const store = useAlerts.getState();
    const lead = ringing ? null : leadCandidate(scheduled, now);
    const leadId = lead ? lead.id : null;
    if (leadId !== store.leading) store.setLeading(leadId);

    const plan = planNext(scheduled, ringing, now);
    if (plan.kind === 'fire') {
      // Its true firedAt, so an alert that came due during a restart rings only
      // for what is left of its window.
      store.fire(plan.alert.id, plan.alert.firesAt);
      return;
    }
    if (plan.kind === 'settle') {
      store.settle();
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
