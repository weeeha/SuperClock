// Kiosk-local quick-settings overrides. Each override remembers the config /
// scheduled value it was set AGAINST; when that base value changes (admin
// push, night boundary), the override is spent and the base resumes. This
// keeps the admin authoritative without a sync protocol.
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

interface Override<T> {
  value: T;
  /** The base (config/scheduled) value at the moment the user overrode it. */
  base: T;
}

interface LocalOverridesState {
  brightness: Override<number> | null;
  night: Override<boolean> | null;
  setBrightness: (value: number, base: number) => void;
  setNight: (value: boolean, base: boolean) => void;
}

export const useLocalOverrides = create<LocalOverridesState>()(
  persist(
    (set) => ({
      brightness: null,
      night: null,
      setBrightness: (value, base) => set({ brightness: { value, base } }),
      setNight: (value, base) => set({ night: { value, base } }),
    }),
    {
      name: 'kiosk:local-overrides',
      // Guard for test/SSR environments without a real browser localStorage
      // (vitest runs under node — Node 26 ships a bare `localStorage` global
      // that warns/throws without `--localstorage-file`). Gate on
      // `window.localStorage` specifically so persist becomes a graceful
      // no-op under node instead of triggering that warning on every write.
      storage:
        typeof window !== 'undefined' && window.localStorage
          ? createJSONStorage(() => window.localStorage)
          : undefined,
    },
  ),
);

/** Resolve brightness: override wins until config moves off its base.
 *  `configValue` is `number | undefined` because callers (e.g.
 *  `apply-settings.ts`) pass `config?.settings.brightness` — undefined means
 *  "no baseline / unfiltered" and must drop a stale override rather than
 *  being coerced to a sentinel number. */
export function effectiveBrightness(configValue: number | undefined): number | undefined {
  const o = useLocalOverrides.getState().brightness;
  if (!o) return configValue;
  if (configValue !== o.base) {
    useLocalOverrides.setState({ brightness: null });
    return configValue;
  }
  return o.value;
}

/** Resolve night: override wins until the schedule next changes. */
export function effectiveNight(scheduled: boolean): boolean {
  const o = useLocalOverrides.getState().night;
  if (!o) return scheduled;
  if (scheduled !== o.base) {
    useLocalOverrides.setState({ night: null });
    return scheduled;
  }
  return o.value;
}
