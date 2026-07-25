// Kiosk-local quick-settings overrides. Each override remembers the config /
// scheduled value it was set AGAINST; when that base value changes (admin
// push, night boundary), the override is spent and the base resumes. This
// keeps the admin authoritative without a sync protocol.
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import type { StateStorage } from 'zustand/middleware';

// zustand's persist defaults `storage` to `createJSONStorage(() => window.localStorage)`
// only when the `storage` key is entirely absent from options. Passing an
// explicit `storage: undefined` (e.g. from a ternary) overrides that default
// with `undefined` itself — persist then falls into its "storage
// unavailable" branch and calls `console.warn` on every single `set()`. So
// under node (no `window`) we must hand it a real no-op `StateStorage`
// rather than `undefined`, to stay silent.
const noopStorage: StateStorage = {
  getItem: () => null,
  setItem: () => {},
  removeItem: () => {},
};

export interface Override<T> {
  value: T;
  /** The base (config/scheduled) value at the moment the user overrode it. */
  base: T;
}

interface LocalOverridesState {
  brightness: Override<number> | null;
  night: Override<boolean> | null;
  setBrightness: (value: number, base: number) => void;
  setNight: (value: boolean, base: boolean) => void;
  /** Clear any override whose stored `base` no longer matches the current
   *  base (admin push moved brightness, or the night schedule flipped). One
   *  setState covering both slices; a no-op (no store write) when nothing is
   *  spent, so it is safe to call from an effect on every base change. */
  dropSpent: (brightnessBase: number | undefined, nightBase: boolean) => void;
}

export const useLocalOverrides = create<LocalOverridesState>()(
  persist(
    (set, get) => ({
      brightness: null,
      night: null,
      setBrightness: (value, base) => set({ brightness: { value, base } }),
      setNight: (value, base) => set({ night: { value, base } }),
      dropSpent: (brightnessBase, nightBase) => {
        const { brightness, night } = get();
        const patch: Partial<Pick<LocalOverridesState, 'brightness' | 'night'>> = {};
        if (brightness && brightness.base !== brightnessBase) patch.brightness = null;
        if (night && night.base !== nightBase) patch.night = null;
        // Only write when something actually clears — avoids needless store
        // notifications (and re-renders) when both bases still match.
        if ('brightness' in patch || 'night' in patch) set(patch);
      },
    }),
    {
      name: 'kiosk:local-overrides',
      // Guard for test/SSR environments without a real browser localStorage
      // (vitest runs under node — Node 26 ships a bare `localStorage` global
      // that warns/throws without `--localstorage-file`). Gate on
      // `window.localStorage` specifically and fall back to a real no-op
      // storage (see `noopStorage` above) — NOT `undefined` — so persist
      // stays silent under node instead of warning on every write.
      storage:
        typeof window !== 'undefined' && window.localStorage
          ? createJSONStorage(() => window.localStorage)
          : createJSONStorage(() => noopStorage),
    },
  ),
);

/** Resolve brightness: override wins until config moves off its base. Pure —
 *  on a base mismatch it just returns the base (the DOM is correct immediately);
 *  clearing the spent override is the caller's job via `dropSpent`.
 *  `configValue` is `number | undefined` because callers (e.g.
 *  `apply-settings.ts`) pass `config?.settings.brightness` — undefined means
 *  "no baseline / unfiltered" and yields the base rather than a sentinel. */
export function effectiveBrightness(
  configValue: number | undefined,
  override: Override<number> | null,
): number | undefined {
  if (!override || configValue !== override.base) return configValue;
  return override.value;
}

/** Resolve night: override wins until the schedule next changes. Pure — same
 *  clear-is-the-caller's-job contract as `effectiveBrightness`. */
export function effectiveNight(scheduled: boolean, override: Override<boolean> | null): boolean {
  if (!override || scheduled !== override.base) return scheduled;
  return override.value;
}
