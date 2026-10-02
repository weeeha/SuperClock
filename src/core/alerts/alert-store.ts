// What is scheduled to interrupt the kiosk, and what is interrupting it now.
// Persisted so an alert survives app unmounts, Chromium's 6-hourly restart and
// deploys (specs docs/superpowers/specs/2026-10-02-alerts-and-timer-design.md
// and 2026-10-02-alarm-design.md).
import { create } from 'zustand';
import { z } from 'zod';
import { useNavigation } from '../navigation';
import { getLeadView } from './views';

export interface ScheduledAlert {
  id: string;
  appId: string;
  firesAt: number;
  sound: boolean;
  payload: Record<string, unknown>;
  /** How long it rings before settling; RING_MS when absent. */
  ringMs?: number;
  /** Hold full brightness while ringing, over night dimming. */
  bright?: boolean;
  /** A lead window before firesAt: panel wake, brightness ramp, the app's lead view. */
  leadMs?: number;
}

export interface RingingAlert extends ScheduledAlert {
  firedAt: number;
  /** Flipped by the scheduler once its ring length has passed: pulse and chime stop. */
  settled: boolean;
}

export interface AlertState {
  scheduled: ScheduledAlert[];
  ringing: RingingAlert | null;
  /** Id of the scheduled alert inside its lead window, set by the scheduler. */
  leading: string | null;
  /** The lead view was tapped away; resets whenever `leading` changes. */
  leadHidden: boolean;
  schedule: (alert: ScheduledAlert) => void;
  cancel: (id: string) => void;
  fire: (id: string, firedAt: number) => void;
  settle: () => void;
  dismiss: () => void;
  setLeading: (id: string | null) => void;
  hideLead: () => void;
}

export const RING_MS = 5 * 60_000;
export const ALERTS_STORAGE_KEY = 'superclock:alerts:v1';

const scheduledSchema = z.object({
  id: z.string().min(1),
  appId: z.string().min(1),
  firesAt: z.number(),
  sound: z.boolean(),
  payload: z.record(z.string(), z.unknown()),
  ringMs: z.number().positive().optional(),
  bright: z.boolean().optional(),
  leadMs: z.number().positive().optional(),
});
const fileSchema = z.object({
  scheduled: z.array(scheduledSchema),
  ringing: scheduledSchema.extend({ firedAt: z.number(), settled: z.boolean() }).nullable(),
  // Absent in files written before the lead window existed.
  leading: z.string().nullable().default(null),
  leadHidden: z.boolean().default(false),
});

type StorageLike = Pick<Storage, 'getItem' | 'setItem'>;
type Persisted = Pick<AlertState, 'scheduled' | 'ringing' | 'leading' | 'leadHidden'>;

function load(storage: StorageLike | null): Persisted {
  const empty: Persisted = { scheduled: [], ringing: null, leading: null, leadHidden: false };
  if (!storage) return empty;
  try {
    const raw = storage.getItem(ALERTS_STORAGE_KEY);
    if (!raw) return empty;
    const parsed = fileSchema.safeParse(JSON.parse(raw));
    // Losing an alert beats a kiosk that crashes on every boot.
    return parsed.success ? parsed.data : empty;
  } catch {
    return empty;
  }
}

/** storage is injectable so the store round-trips under test without a DOM. */
export function createAlertStore(storage: StorageLike | null) {
  const store = create<AlertState>()((set, get) => {
    const unlead = (id: string) => (get().leading === id ? { leading: null, leadHidden: false } : {});
    return {
      ...load(storage),
      schedule: (alert) =>
        set({ scheduled: [...get().scheduled.filter((a) => a.id !== alert.id), alert] }),
      cancel: (id) => {
        const { scheduled } = get();
        if (!scheduled.some((a) => a.id === id)) return;
        set({ scheduled: scheduled.filter((a) => a.id !== id), ...unlead(id) });
      },
      fire: (id, firedAt) => {
        const { scheduled, ringing } = get();
        if (ringing) return; // one at a time; the scheduler fires the next after dismiss
        const alert = scheduled.find((a) => a.id === id);
        if (!alert) return;
        set({
          scheduled: scheduled.filter((a) => a.id !== id),
          ringing: { ...alert, firedAt, settled: false },
          ...unlead(id),
        });
      },
      settle: () => {
        const { ringing } = get();
        if (ringing && !ringing.settled) set({ ringing: { ...ringing, settled: true } });
      },
      dismiss: () => {
        if (!get().ringing) return;
        set({ ringing: null });
        // Playlist rotation resumes after its usual post-gesture cooldown.
        useNavigation.getState().noteUserGesture();
      },
      setLeading: (id) => {
        if (get().leading !== id) set({ leading: id, leadHidden: false });
      },
      hideLead: () => {
        const { leading, leadHidden } = get();
        if (leading && !leadHidden) set({ leadHidden: true });
      },
    };
  });
  store.subscribe((s) => {
    if (!storage) return;
    try {
      storage.setItem(
        ALERTS_STORAGE_KEY,
        JSON.stringify({ scheduled: s.scheduled, ringing: s.ringing, leading: s.leading, leadHidden: s.leadHidden }),
      );
    } catch {
      // Full or blocked storage: the alert still rings this session.
    }
  });
  return store;
}

const defaultStorage =
  typeof window !== 'undefined' && window.localStorage ? window.localStorage : null;

export const useAlerts = createAlertStore(defaultStorage);

export function ringPhase(alert: RingingAlert): 'ringing' | 'settled' {
  return alert.settled ? 'settled' : 'ringing';
}

/** True while an alert rings, or while an app's lead view is on screen. */
export function selectScreenHeld(
  s: Pick<AlertState, 'scheduled' | 'ringing' | 'leading' | 'leadHidden'>,
): boolean {
  if (s.ringing) return true;
  if (!s.leading || s.leadHidden) return false;
  const alert = s.scheduled.find((a) => a.id === s.leading);
  return Boolean(alert && getLeadView(alert.appId));
}

/** Non-hook read for the shell's plain functions (gestures, idle, playlist). */
export function isScreenHeld(): boolean {
  return selectScreenHeld(useAlerts.getState());
}
