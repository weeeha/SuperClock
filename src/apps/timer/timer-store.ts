// The one timer on this clock. Module scope because SwipeContainer unmounts
// the app on swipe-away; persisted so a running timer survives a reload. The
// alert itself lives in the core alert store, which rings it from anywhere.
import { create } from 'zustand';
import { z } from 'zod';
import { useAlerts, type AlertState } from '../../core/alerts/alert-store';
import { snapClamp } from './dial';

export type TimerState =
  | { status: 'idle'; durationMs: number }
  | { status: 'running'; durationMs: number; endsAt: number }
  | { status: 'paused'; durationMs: number; remainingMs: number };

interface TimerStore {
  state: TimerState;
  setDuration: (ms: number) => void;
  start: (sound: boolean, now?: number) => void;
  pause: (now?: number) => void;
  resume: (sound: boolean, now?: number) => void;
  reset: () => void;
  finish: () => void;
  reconcile: (now?: number) => void;
}

export const TIMER_ALERT_ID = 'timer';
export const TIMER_STORAGE_KEY = 'superclock:app:timer:v1';

const stateSchema = z.discriminatedUnion('status', [
  z.object({ status: z.literal('idle'), durationMs: z.number() }),
  z.object({ status: z.literal('running'), durationMs: z.number(), endsAt: z.number() }),
  z.object({ status: z.literal('paused'), durationMs: z.number(), remainingMs: z.number() }),
]);

type StorageLike = Pick<Storage, 'getItem' | 'setItem'>;

function load(storage: StorageLike | null): TimerState {
  const fresh: TimerState = { status: 'idle', durationMs: 0 };
  if (!storage) return fresh;
  try {
    const raw = storage.getItem(TIMER_STORAGE_KEY);
    if (!raw) return fresh;
    const parsed = stateSchema.safeParse(JSON.parse(raw));
    return parsed.success ? parsed.data : fresh;
  } catch {
    return fresh;
  }
}

export function createTimerStore(storage: StorageLike | null, alerts: { getState(): AlertState }) {
  const scheduleAlert = (firesAt: number, durationMs: number, sound: boolean) =>
    alerts.getState().schedule({ id: TIMER_ALERT_ID, appId: 'timer', firesAt, sound, payload: { durationMs } });

  const store = create<TimerStore>()((set, get) => ({
    state: load(storage),
    setDuration: (ms) => {
      if (get().state.status !== 'idle') return;
      set({ state: { status: 'idle', durationMs: snapClamp(ms) } });
    },
    start: (sound, now = Date.now()) => {
      const s = get().state;
      if (s.status !== 'idle' || s.durationMs <= 0) return;
      const endsAt = now + s.durationMs;
      scheduleAlert(endsAt, s.durationMs, sound);
      set({ state: { status: 'running', durationMs: s.durationMs, endsAt } });
    },
    pause: (now = Date.now()) => {
      const s = get().state;
      if (s.status !== 'running') return;
      alerts.getState().cancel(TIMER_ALERT_ID);
      set({ state: { status: 'paused', durationMs: s.durationMs, remainingMs: Math.max(0, s.endsAt - now) } });
    },
    resume: (sound, now = Date.now()) => {
      const s = get().state;
      if (s.status !== 'paused') return;
      const endsAt = now + s.remainingMs;
      scheduleAlert(endsAt, s.durationMs, sound);
      set({ state: { status: 'running', durationMs: s.durationMs, endsAt } });
    },
    reset: () => {
      const s = get().state;
      if (s.status === 'idle') return;
      alerts.getState().cancel(TIMER_ALERT_ID);
      set({ state: { status: 'idle', durationMs: s.durationMs } });
    },
    finish: () => set({ state: { status: 'idle', durationMs: get().state.durationMs } }),
    reconcile: (now = Date.now()) => {
      const s = get().state;
      if (s.status !== 'running' || s.endsAt > now) return;
      const { scheduled, ringing } = alerts.getState();
      const live = scheduled.some((a) => a.id === TIMER_ALERT_ID) || ringing?.id === TIMER_ALERT_ID;
      // An alert cleared through the layer's fallback view never calls finish().
      if (!live) set({ state: { status: 'idle', durationMs: s.durationMs } });
    },
  }));

  store.subscribe(({ state }) => {
    if (!storage) return;
    try {
      storage.setItem(TIMER_STORAGE_KEY, JSON.stringify(state));
    } catch {
      // Full or blocked storage: the timer still runs this session.
    }
  });
  store.getState().reconcile();
  return store;
}

const defaultStorage =
  typeof window !== 'undefined' && window.localStorage ? window.localStorage : null;

export const useTimer = createTimerStore(defaultStorage, useAlerts);
