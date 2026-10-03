// What is scheduled to interrupt the kiosk, and what is interrupting it now.
// Persisted so an alert survives app unmounts, Chromium's 6-hourly restart and
// deploys (spec docs/superpowers/specs/2026-10-02-alerts-and-timer-design.md).
import { create } from 'zustand';
import { z } from 'zod';
import { useNavigation } from '../navigation';

export interface ScheduledAlert {
  id: string;
  appId: string;
  firesAt: number;
  sound: boolean;
  payload: Record<string, unknown>;
}

export interface RingingAlert extends ScheduledAlert {
  firedAt: number;
  /** Flipped by the scheduler RING_MS after firedAt: pulse and chime stop. */
  settled: boolean;
}

export interface AlertState {
  scheduled: ScheduledAlert[];
  ringing: RingingAlert | null;
  schedule: (alert: ScheduledAlert) => void;
  cancel: (id: string) => void;
  fire: (id: string, firedAt: number) => void;
  settle: () => void;
  dismiss: () => void;
}

export const RING_MS = 5 * 60_000;
export const ALERTS_STORAGE_KEY = 'superclock:alerts:v1';

const scheduledSchema = z.object({
  id: z.string().min(1),
  appId: z.string().min(1),
  firesAt: z.number(),
  sound: z.boolean(),
  payload: z.record(z.string(), z.unknown()),
});
const fileSchema = z.object({
  scheduled: z.array(scheduledSchema),
  ringing: scheduledSchema.extend({ firedAt: z.number(), settled: z.boolean() }).nullable(),
});

type StorageLike = Pick<Storage, 'getItem' | 'setItem'>;
type Persisted = Pick<AlertState, 'scheduled' | 'ringing'>;

function load(storage: StorageLike | null): Persisted {
  const empty: Persisted = { scheduled: [], ringing: null };
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
  const store = create<AlertState>()((set, get) => ({
    ...load(storage),
    schedule: (alert) =>
      set({ scheduled: [...get().scheduled.filter((a) => a.id !== alert.id), alert] }),
    cancel: (id) => {
      const { scheduled } = get();
      if (scheduled.some((a) => a.id === id)) set({ scheduled: scheduled.filter((a) => a.id !== id) });
    },
    fire: (id, firedAt) => {
      const { scheduled, ringing } = get();
      if (ringing) return; // one at a time; the scheduler fires the next after dismiss
      const alert = scheduled.find((a) => a.id === id);
      if (!alert) return;
      set({
        scheduled: scheduled.filter((a) => a.id !== id),
        ringing: { ...alert, firedAt, settled: false },
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
  }));
  store.subscribe((s) => {
    if (!storage) return;
    try {
      storage.setItem(ALERTS_STORAGE_KEY, JSON.stringify({ scheduled: s.scheduled, ringing: s.ringing }));
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

/** Non-hook read for the shell's plain functions (gestures, idle, playlist). */
export function isAlertRinging(): boolean {
  return useAlerts.getState().ringing !== null;
}
