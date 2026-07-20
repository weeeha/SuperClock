import { useEffect, useSyncExternalStore } from 'react';
import { useDeviceConfig } from './device-config';
import { isWithinWindow } from '../shared/time-window';

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

  const isNight = useSyncExternalStore(
    subscribeToNightTick,
    () =>
      nightStart !== undefined &&
      nightEnd !== undefined &&
      isWithinWindow({ start: nightStart, end: nightEnd }, new Date()),
    getServerSnapshot,
  );

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

  useEffect(() => {
    const root = document.documentElement;
    root.style.transition = 'filter 1s ease';
    const effective =
      isNight && typeof nightBrightness === 'number' ? nightBrightness : dayBrightness;
    // ≥100 (or unset) renders unfiltered — brightness(1) would be an identity
    // filter that still costs a stacking context.
    if (typeof effective === 'number' && effective < 100) {
      const pct = Math.max(0, effective);
      root.style.filter = `brightness(${pct / 100})`;
    } else {
      root.style.filter = '';
    }
    return () => {
      root.style.filter = '';
      root.style.transition = '';
    };
  }, [isNight, nightBrightness, dayBrightness]);
}
