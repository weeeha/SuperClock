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
//   night.brightness → CSS brightness() filter on <html> while the window is
//            active, independent of theme. No released wlr-randr has a
//            brightness flag, so the kiosk dims its own rendering; on this
//            fixed-backlight LCD that is visually equivalent to compositor
//            gamma. Panel power (sleep schedule) stays server-side.
export function useApplySettings(): void {
  const config = useDeviceConfig();
  const accent = config?.settings.accent;
  const theme = config?.settings.theme;
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
    if (isNight && typeof nightBrightness === 'number') {
      const pct = Math.min(100, Math.max(0, nightBrightness));
      root.style.filter = `brightness(${pct / 100})`;
    } else {
      root.style.filter = '';
    }
    return () => {
      root.style.filter = '';
      root.style.transition = '';
    };
  }, [isNight, nightBrightness]);
}
