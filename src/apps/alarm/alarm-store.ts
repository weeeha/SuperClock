// The clock's alarms. Module scope because SwipeContainer unmounts the app on
// swipe-away; persisted so alarms survive restarts. Ringing them is the core
// alert layer's job (alarm-sync.ts keeps one alert per enabled alarm).
import { create } from 'zustand';
import { z } from 'zod';

export interface Alarm {
  id: string;
  /** 'HH:MM', 24-hour. */
  time: string;
  /** 0 Sunday … 6 Saturday; empty means once. */
  days: number[];
  enabled: boolean;
}

interface AlarmStore {
  alarms: Alarm[];
  add: (time: string, days: number[]) => string;
  update: (id: string, patch: Partial<Omit<Alarm, 'id'>>) => void;
  toggle: (id: string) => void;
  remove: (id: string) => void;
}

export const ALARM_STORAGE_KEY = 'superclock:app:alarm:v1';

const alarmSchema = z.object({
  id: z.string().min(1),
  time: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
  days: z.array(z.number().int().min(0).max(6)),
  enabled: z.boolean(),
});

type StorageLike = Pick<Storage, 'getItem' | 'setItem'>;

const normalizeDays = (days: number[]) =>
  [...new Set(days)].filter((d) => Number.isInteger(d) && d >= 0 && d <= 6).sort((a, b) => a - b);

function load(storage: StorageLike | null): Alarm[] {
  if (!storage) return [];
  try {
    const raw = storage.getItem(ALARM_STORAGE_KEY);
    if (!raw) return [];
    const parsed = z.array(alarmSchema).safeParse(JSON.parse(raw));
    return parsed.success ? parsed.data : [];
  } catch {
    return [];
  }
}

const defaultId = () =>
  typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `a${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;

export function createAlarmStore(storage: StorageLike | null, newId: () => string = defaultId) {
  const store = create<AlarmStore>()((set, get) => ({
    alarms: load(storage),
    add: (time, days) => {
      const id = newId();
      set({ alarms: [...get().alarms, { id, time, days: normalizeDays(days), enabled: true }] });
      return id;
    },
    update: (id, patch) =>
      set({
        alarms: get().alarms.map((a) =>
          a.id === id ? { ...a, ...patch, ...(patch.days ? { days: normalizeDays(patch.days) } : {}) } : a,
        ),
      }),
    toggle: (id) => set({ alarms: get().alarms.map((a) => (a.id === id ? { ...a, enabled: !a.enabled } : a)) }),
    remove: (id) => set({ alarms: get().alarms.filter((a) => a.id !== id) }),
  }));
  store.subscribe(({ alarms }) => {
    if (!storage) return;
    try {
      storage.setItem(ALARM_STORAGE_KEY, JSON.stringify(alarms));
    } catch {
      // Full or blocked storage: the alarms still ring this session.
    }
  });
  return store;
}

const defaultStorage =
  typeof window !== 'undefined' && window.localStorage ? window.localStorage : null;

export const useAlarms = createAlarmStore(defaultStorage);
