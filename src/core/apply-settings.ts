import { useEffect, useSyncExternalStore } from 'react';
import { useDeviceConfig } from './device-config';
import { isWithinWindow } from '../shared/time-window';
import { useLocalOverrides, effectiveBrightness, effectiveNight } from './local-overrides';

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

  // re-render when overrides change (values consumed via effective* below)
  useLocalOverrides((s) => s.brightness);
  useLocalOverrides((s) => s.night);

  const scheduledNight = useSyncExternalStore(
    subscribeToNightTick,
    () =>
      nightStart !== undefined &&
      nightEnd !== undefined &&
      isWithinWindow({ start: nightStart, end: nightEnd }, new Date()),
    getServerSnapshot,
  );
  // A local night override wins until the schedule next flips (resolver drops a
  // spent override on that boundary). Recomputed each render — including on the
  // NIGHT_TICK_MS ticks that re-run this hook via useSyncExternalStore.
  const isNight = effectiveNight(scheduledNight);

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
  // effect via the `pct` dep.
  const basePct =
    isNight && typeof nightBrightness === 'number' ? nightBrightness : dayBrightness;
  const pct = effectiveBrightness(basePct);

  useEffect(() => {
    const root = document.documentElement;
    root.style.transition = 'filter 1s ease';
    // ≥100 (or unset) renders unfiltered — brightness(1) would be an identity
    // filter that still costs a stacking context.
    if (typeof pct === 'number' && pct < 100) {
      const clamped = Math.max(0, pct);
      root.style.filter = `brightness(${clamped / 100})`;
    } else {
      root.style.filter = '';
    }
    return () => {
      root.style.filter = '';
      root.style.transition = '';
    };
  }, [pct]);
}
