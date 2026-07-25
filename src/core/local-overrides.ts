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

export interface Override<V, B = V> {
  value: V;
  /** The base (config/scheduled) value at the moment the user overrode it. */
  base: B;
}

// Brightness's base is `number | undefined`: a fleet config with brightness
// unset (= unfiltered) is a legitimate base to override against. `undefined ===
// undefined` keeps such an override alive; a later numeric config drops it.
export type BrightnessOverride = Override<number, number | undefined>;

interface LocalOverridesState {
  brightness: BrightnessOverride | null;
  night: Override<boolean> | null;
  /** The live bases published by `apply-settings` via `syncBases`. Runtime-
   *  derived (night-aware brightness baseline + scheduled night) — the sheet
   *  reads these so it overrides against the SAME base the resolver checks,
   *  never a duplicated night-window computation. Not persisted. */
  bases: { brightness: number | undefined; night: boolean };
  setBrightness: (value: number, base: number | undefined) => void;
  setNight: (value: boolean, base: boolean) => void;
  /** Record the current bases AND clear any override whose stored `base` no
   *  longer matches (admin push moved brightness, or the night schedule
   *  flipped). One setState covering all touched slices; a no-op (no store
   *  write) when nothing is spent AND the bases are unchanged, so it is safe to
   *  call from an effect on every base change. */
  syncBases: (brightnessBase: number | undefined, nightBase: boolean) => void;
}

export const useLocalOverrides = create<LocalOverridesState>()(
  persist(
    (set, get) => ({
      brightness: null,
      night: null,
      bases: { brightness: undefined, night: false },
      setBrightness: (value, base) => set({ brightness: { value, base } }),
      setNight: (value, base) => set({ night: { value, base } }),
      syncBases: (brightnessBase, nightBase) => {
        const { brightness, night, bases } = get();
        const patch: Partial<
          Pick<LocalOverridesState, 'brightness' | 'night' | 'bases'>
        > = {};
        if (brightness && brightness.base !== brightnessBase) patch.brightness = null;
        if (night && night.base !== nightBase) patch.night = null;
        if (bases.brightness !== brightnessBase || bases.night !== nightBase) {
          patch.bases = { brightness: brightnessBase, night: nightBase };
        }
        // Only write when something actually changed — avoids needless store
        // notifications (and re-renders) when nothing is spent and the bases
        // still match.
        if ('brightness' in patch || 'night' in patch || 'bases' in patch) set(patch);
      },
    }),
    {
      name: 'kiosk:local-overrides',
      // Persist only the overrides — `bases` is runtime-derived (republished
      // every render by apply-settings) and must not survive a reload.
      partialize: (state) => ({ brightness: state.brightness, night: state.night }),
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
 *  clearing the spent override is the caller's job via `syncBases`.
 *  `configValue` is `number | undefined` because callers (e.g.
 *  `apply-settings.ts`) pass `config?.settings.brightness` — undefined means
 *  "no baseline / unfiltered". An override set against an undefined base stays
 *  alive while the base remains undefined (`undefined === undefined`). */
export function effectiveBrightness(
  configValue: number | undefined,
  override: BrightnessOverride | null,
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
