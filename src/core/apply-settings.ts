import { useEffect, useSyncExternalStore } from 'react';
import { useDeviceConfig } from './device-config';
import { isWithinWindow } from '../shared/time-window';
import { useLocalOverrides, effectiveBrightness, effectiveNight } from './local-overrides';
import { useBrightnessLease } from './brightness-lease';

// Re-evaluate the night window this often. Boundary lag budget: ≤5s config
// poll + ≤30s tick — same cadence as the server's display-adapter evaluator.
const NIGHT_TICK_MS = 30_000;

// Wall-clock time as an external store: notify subscribers every tick; the
// snapshot is the isNight boolean, so React re-renders only when it flips.
function subscribeToNightTick(onTick: () => void): () => void {
  const timer = window.setInterval(onTick, NIGHT_TICK_MS);
  return () => window.clearInterval(timer);
}

const getServerSnapshot = (): boolean => false;

// Reflects DeviceConfig.settings on the live kiosk DOM.
//   accent → overrides --color-accent on <html>
//   theme  → 'light'/'dark' force the html class; 'system' ("Auto" in the
//            admin) follows the night window: dark inside settings.night,
//            light outside. No config / no window → light (today's look).
//   brightness → CSS brightness() filter on <html>, independent of theme.
//            settings.brightness is the daytime baseline; night.brightness
//            overrides it while the night window is active. No released
//            wlr-randr has a brightness flag and these panels expose no
//            backlight device, so the kiosk dims its own rendering; on this
//            fixed-backlight LCD that is visually equivalent to compositor
//            gamma. Panel power (sleep schedule) stays server-side.
export function useApplySettings(): void {
  const config = useDeviceConfig();
  const accent = config?.settings.accent;
  const theme = config?.settings.theme;
  const dayBrightness = config?.settings.brightness;
  const nightStart = config?.settings.night?.start;
  const nightEnd = config?.settings.night?.end;
  const nightBrightness = config?.settings.night?.brightness;

  // Subscribe to the override slices so the hook re-runs when the quick-settings
  // sheet writes one; the values feed the pure resolvers below.
  const brightnessOverride = useLocalOverrides((s) => s.brightness);
  const nightOverride = useLocalOverrides((s) => s.night);

  const scheduledNight = useSyncExternalStore(
    subscribeToNightTick,
    () =>
      nightStart !== undefined &&
      nightEnd !== undefined &&
      isWithinWindow({ start: nightStart, end: nightEnd }, new Date()),
    getServerSnapshot,
  );
  // A local night override wins until the schedule next flips. The resolver is
  // pure — on a boundary flip it returns the schedule immediately (DOM correct),
  // and the syncBases effect below tidies the now-spent override.
  const isNight = effectiveNight(scheduledNight, nightOverride);
  const brightnessLeased = useBrightnessLease();

  useEffect(() => {
    const root = document.documentElement;
    if (accent) {
      root.style.setProperty('--color-accent', accent);
    } else {
      root.style.removeProperty('--color-accent');
    }
    return () => {
      root.style.removeProperty('--color-accent');
    };
  }, [accent]);

  useEffect(() => {
    const root = document.documentElement;
    const dark = theme === 'dark' || (theme !== 'light' && isNight);
    root.classList.toggle('dark', dark);
    root.classList.toggle('light', !dark);
  }, [theme, isNight]);

  // Night wins the baseline; then a local brightness override wins until config
  // moves off its base. Resolved in render (not the effect) so a quick-settings
  // slider change — which re-renders this hook via the subscription above but
  // touches none of isNight/nightBrightness/dayBrightness — still reaches the
  // effect via the `applied` dep.
  const basePct =
    isNight && typeof nightBrightness === 'number' ? nightBrightness : dayBrightness;
  const pct = effectiveBrightness(basePct, brightnessOverride);
  // A leased screen (an in-progress workout) renders unfiltered regardless of
  // the night window or a local override — you cannot read a dimmed timer
  // mid-exercise. The lease outranks the dimming pipeline but never touches
  // the override/base bookkeeping in syncBases below.
  const applied = brightnessLeased ? undefined : pct;

  // Publish the live bases and tidy spent overrides in an effect, not during
  // render (React 19 forbids updating a store other components read while
  // rendering). The resolvers already returned the base on a mismatch, so the
  // DOM is correct before this runs; a night-override drop that shifts basePct
  // converges next render. Publishing basePct/scheduledNight here is what lets
  // the quick-settings sheet override against the SAME night-aware base — it
  // must never recompute the night window itself (spurious spent-drop risk).
  useEffect(() => {
    useLocalOverrides.getState().syncBases(basePct, scheduledNight);
  }, [basePct, scheduledNight]);

  useEffect(() => {
    const root = document.documentElement;
    root.style.transition = 'filter 1s ease';
    // ≥100 (or unset) renders unfiltered — brightness(1) would be an identity
    // filter that still costs a stacking context.
    if (typeof applied === 'number' && applied < 100) {
      const clamped = Math.max(0, applied);
      root.style.filter = `brightness(${clamped / 100})`;
    } else {
      root.style.filter = '';
    }
    return () => {
      root.style.filter = '';
      root.style.transition = '';
    };
  }, [applied]);
}
