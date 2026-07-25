// Spec: overlays self-dismiss after 20s untouched; the kiosk returns to the
// home app (appOrder[0]) after ~5min. Single 5s interval, visibility-gated.
// Note: this resets the ACTIVE APP, not any per-app face/view state — faces
// are ClockApp-internal (e.g. which watchface is showing) and are never
// touched here.
//
// Deferral rule: home-return backs off while a playlist is actively driving
// navigation (isPlaylistDriving() from ../playlist) — an admin-configured
// playlist is intentional ambient behavior, not stranded navigation, so it
// should keep rotating rather than getting yanked back to the home app.
// Idle-home exists to rescue a kiosk left mid-swipe/mid-app by a person, not
// to fight a playlist the admin turned on. Overlay dismissal is NOT gated by
// this — an idle grid/settings sheet dismisses unconditionally even while a
// playlist rotates underneath it.
import { useEffect } from 'react';
import { useNavigation } from '../navigation';
import { isPlaylistDriving } from '../playlist';

export const OVERLAY_IDLE_MS = 20_000;
export const HOME_IDLE_MS = 5 * 60_000;

/** Exported for tests — one idle sweep against the nav store. */
export function checkIdle(): void {
  const nav = useNavigation.getState();
  if (nav.lastGestureMs === 0) return;
  const idle = Date.now() - nav.lastGestureMs;

  if (idle > OVERLAY_IDLE_MS) {
    // grid and settings are mutually exclusive store states (showGrid clears
    // settingsOpen, and showSettings only runs when mode === 'app'), so at
    // most one of these fires — this is not a double-dismiss path.
    if (nav.mode === 'grid') nav.hideGrid();
    if (nav.settingsOpen) nav.hideSettings();
  }

  if (idle > HOME_IDLE_MS && nav.mode === 'app' && !isPlaylistDriving()) {
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
