// Spec: overlays self-dismiss after 20s untouched; the kiosk returns to the
// default face after ~5min. Single 5s interval, visibility-gated.
import { useEffect } from 'react';
import { useNavigation } from '../navigation';

export const OVERLAY_IDLE_MS = 20_000;
export const HOME_IDLE_MS = 5 * 60_000;

/** Exported for tests — one idle sweep against the nav store. */
export function checkIdle(): void {
  const nav = useNavigation.getState();
  if (nav.lastGestureMs === 0) return;
  const idle = Date.now() - nav.lastGestureMs;

  if (idle > OVERLAY_IDLE_MS) {
    if (nav.mode === 'grid') nav.hideGrid();
    if (nav.settingsOpen) nav.hideSettings();
  }

  if (idle > HOME_IDLE_MS && nav.mode === 'app') {
    const home = nav.appOrder[0];
    if (home && nav.activeAppId !== home) nav.switchToApp(home);
  }
}

export function useIdleReturn(): void {
  useEffect(() => {
    let id: ReturnType<typeof setInterval> | null = null;
    const start = () => { if (!id) id = setInterval(checkIdle, 5000); };
    const stop = () => { if (id) { clearInterval(id); id = null; } };
    const onVisibility = () => (document.hidden ? stop() : start());
    document.addEventListener('visibilitychange', onVisibility);
    start();
    return () => { stop(); document.removeEventListener('visibilitychange', onVisibility); };
  }, []);
}
