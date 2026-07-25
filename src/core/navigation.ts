import { create } from 'zustand';
import { getAppIds } from './registry';

export type NavMode = 'app' | 'grid' | 'transitioning';

interface NavigationState {
  mode: NavMode;
  activeAppId: string;
  /** Tracks the specific instance currently displayed — set by playlist auto-rotate. */
  activeInstanceId: string | null;
  appOrder: string[];
  transitionDirection: 'left' | 'right' | null;
  verticalSwipeCallback: ((dir: 'up' | 'down') => void) | null;
  /** epoch ms of last user-initiated gesture — used by playlist to pause auto-rotate. */
  lastGestureMs: number;
  /** Quick-settings sheet — an overlay FLAG, deliberately not a NavMode:
   *  it must never interact with the transition contract below. */
  settingsOpen: boolean;
  /** Live drag progress (0..1) of an arc peek gesture, for peek-follow UI. */
  peek: { target: 'settings' | 'grid'; progress: number } | null;
  /** System back (left-arc swipe). Registered by drilled-in apps, same
   *  ownership pattern as verticalSwipeCallback — including guarded cleanup. */
  backCallback: (() => void) | null;

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
  /** 3-finger tap: panic/home — default clock, from any state (spec 2026-07-24). */
  panicHome: () => void;
  finishTransition: () => void;
  setVerticalSwipeCallback: (fn: ((dir: 'up' | 'down') => void) | null) => void;
  noteUserGesture: () => void;
  showSettings: () => void;
  hideSettings: () => void;
  setPeek: (peek: { target: 'settings' | 'grid'; progress: number } | null) => void;
  setBackCallback: (fn: (() => void) | null) => void;
  goBack: () => void;
}

export const useNavigation = create<NavigationState>((set, get) => ({
  mode: 'app',
  activeAppId: '',
  activeInstanceId: null,
  appOrder: [],
  transitionDirection: null,
  verticalSwipeCallback: null,
  lastGestureMs: 0,
  settingsOpen: false,
  peek: null,
  backCallback: null,

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

  showGrid: () => set({ mode: 'grid', settingsOpen: false, peek: null, lastGestureMs: Date.now() }),
  hideGrid: () => set({ mode: 'app', lastGestureMs: Date.now() }),
  panicHome: () => {
    set({ settingsOpen: false, peek: null, lastGestureMs: Date.now() });
    // Reuse switchToApp so the transition contract (mode:'transitioning' <=>
    // key change) holds from every state — app/grid/transitioning alike.
    get().switchToApp(get().appOrder[0] ?? get().activeAppId);
  },
  finishTransition: () => set({ mode: 'app', transitionDirection: null }),
  setVerticalSwipeCallback: (fn) => set({ verticalSwipeCallback: fn }),
  noteUserGesture: () => set({ lastGestureMs: Date.now() }),

  showSettings: () => {
    const { mode, settingsOpen } = get();
    if (mode !== 'app' || settingsOpen) return;
    set({ settingsOpen: true, peek: null, lastGestureMs: Date.now() });
  },
  hideSettings: () => set({ settingsOpen: false, peek: null, lastGestureMs: Date.now() }),
  setPeek: (peek) => set({ peek }),
  setBackCallback: (fn) => set({ backCallback: fn }),
  goBack: () => {
    const { backCallback } = get();
    if (!backCallback) return; // no-op at app top level, per spec
    set({ lastGestureMs: Date.now() });
    backCallback();
  },
}));

// Expose for debugging in dev (window-guarded: this module also loads under
// node in tests).
if (import.meta.env.DEV && typeof window !== 'undefined') {
  (window as unknown as { __nav: typeof useNavigation }).__nav = useNavigation;
}
