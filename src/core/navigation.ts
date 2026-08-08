import { create } from 'zustand';
import { getAppIds } from './registry';

export type NavMode = 'app' | 'grid' | 'quick-settings' | 'transitioning';

/** Modes where a full-screen shell surface covers the app. Apps gate their
 *  timers on isActive, so anything listed here deactivates the app beneath. */
export function isOverlayMode(mode: NavMode): boolean {
  return mode === 'grid' || mode === 'quick-settings';
}

/** Which rim the shell briefly bounces when a vertical swipe had no owner. */
export interface EdgeHint {
  edge: 'top' | 'bottom';
  /** Changes on every flash so a repeat hint re-triggers the animation. */
  id: number;
}

interface NavigationState {
  mode: NavMode;
  activeAppId: string;
  /** Tracks the specific instance currently displayed — set by playlist auto-rotate. */
  activeInstanceId: string | null;
  appOrder: string[];
  transitionDirection: 'left' | 'right' | null;
  /** Apps own interior vertical. Return false to decline a direction the app
   *  has nothing to do with — the shell then hints the edge zone instead of
   *  swallowing the gesture. Returning void counts as handled. */
  verticalSwipeCallback: ((dir: 'up' | 'down') => boolean | void) | null;
  /** Apps with internal hierarchy claim the back gesture. Return true if the
   *  app consumed it; false/absent falls through to the shell (-> grid). */
  backCallback: (() => boolean) | null;
  edgeHint: EdgeHint | null;
  /** epoch ms of last user-initiated gesture — used by playlist to pause auto-rotate. */
  lastGestureMs: number;

  // Actions
  /** (Re)build appOrder from the registry, filtered to `enabledApps` when
   *  non-empty. Empty/undefined = all registered apps (fresh-device default). */
  initApps: (enabledApps?: string[]) => void;
  switchToApp: (id: string) => void;
  switchToInstance: (instanceId: string, appId: string) => void;
  swipeToNext: () => void;
  swipeToPrev: () => void;
  showGrid: () => void;
  hideGrid: () => void;
  showQuickSettings: () => void;
  /** Close whichever shell overlay is open. */
  dismissOverlay: () => void;
  /** Offer back to the active app; fall through to the grid if it declines. */
  goBack: () => void;
  flashEdgeHint: (edge: 'top' | 'bottom') => void;
  clearEdgeHint: () => void;
  finishTransition: () => void;
  setVerticalSwipeCallback: (fn: ((dir: 'up' | 'down') => boolean | void) | null) => void;
  setBackCallback: (fn: (() => boolean) | null) => void;
  noteUserGesture: () => void;
}

export const useNavigation = create<NavigationState>((set, get) => ({
  mode: 'app',
  activeAppId: '',
  activeInstanceId: null,
  appOrder: [],
  transitionDirection: null,
  verticalSwipeCallback: null,
  backCallback: null,
  edgeHint: null,
  lastGestureMs: 0,

  initApps: (enabledApps) => {
    const all = getAppIds();
    const ids =
      enabledApps && enabledApps.length > 0
        ? all.filter((id) => enabledApps.includes(id))
        : all;
    if (ids.length === 0) {
      // A config that disables every known app must not blank the kiosk.
      set({ appOrder: all, activeAppId: get().activeAppId || all[0] || '' });
      return;
    }
    const { activeAppId } = get();
    set({
      appOrder: ids,
      // Keep the current app when it's still enabled; otherwise land on the
      // first enabled app instead of a now-disabled one.
      activeAppId: ids.includes(activeAppId) ? activeAppId : ids[0],
    });
  },

  switchToApp: (id: string) => {
    const { activeAppId } = get();
    if (id === activeAppId) {
      set({ mode: 'app' });
      return;
    }
    set({
      mode: 'transitioning',
      activeAppId: id,
      activeInstanceId: null,
      transitionDirection: 'right',
    });
  },

  switchToInstance: (instanceId, appId) => {
    const { activeInstanceId } = get();
    if (instanceId === activeInstanceId) return;
    set({
      mode: 'transitioning',
      activeAppId: appId,
      activeInstanceId: instanceId,
      transitionDirection: 'left',
    });
  },

  swipeToNext: () => {
    const { appOrder, activeAppId } = get();
    const idx = appOrder.indexOf(activeAppId);
    const nextIdx = (idx + 1) % appOrder.length;
    set({
      mode: 'transitioning',
      activeAppId: appOrder[nextIdx],
      activeInstanceId: null,
      transitionDirection: 'left',
      lastGestureMs: Date.now(),
    });
  },

  swipeToPrev: () => {
    const { appOrder, activeAppId } = get();
    const idx = appOrder.indexOf(activeAppId);
    const prevIdx = (idx - 1 + appOrder.length) % appOrder.length;
    set({
      mode: 'transitioning',
      activeAppId: appOrder[prevIdx],
      activeInstanceId: null,
      transitionDirection: 'right',
      lastGestureMs: Date.now(),
    });
  },

  showGrid: () => set({ mode: 'grid', lastGestureMs: Date.now() }),
  hideGrid: () => set({ mode: 'app', lastGestureMs: Date.now() }),
  showQuickSettings: () => set({ mode: 'quick-settings', lastGestureMs: Date.now() }),
  dismissOverlay: () => set({ mode: 'app', lastGestureMs: Date.now() }),

  goBack: () => {
    const { backCallback, showGrid } = get();
    // The app gets first refusal; at its root it declines and the shell
    // surfaces the grid, so back is never a dead gesture.
    if (backCallback?.()) {
      set({ lastGestureMs: Date.now() });
      return;
    }
    showGrid();
  },

  flashEdgeHint: (edge) => set({ edgeHint: { edge, id: Date.now() } }),
  clearEdgeHint: () => set({ edgeHint: null }),

  finishTransition: () => set({ mode: 'app', transitionDirection: null }),
  setVerticalSwipeCallback: (fn) => set({ verticalSwipeCallback: fn }),
  setBackCallback: (fn) => set({ backCallback: fn }),
  noteUserGesture: () => set({ lastGestureMs: Date.now() }),
}));

// Expose for debugging in dev (window-guarded: this module also loads under
// node in tests).
if (import.meta.env.DEV && typeof window !== 'undefined') {
  (window as unknown as { __nav: typeof useNavigation }).__nav = useNavigation;
}
