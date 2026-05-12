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

  // Actions
  initApps: () => void;
  switchToApp: (id: string) => void;
  switchToInstance: (instanceId: string, appId: string) => void;
  swipeToNext: () => void;
  swipeToPrev: () => void;
  showGrid: () => void;
  hideGrid: () => void;
  finishTransition: () => void;
  setVerticalSwipeCallback: (fn: ((dir: 'up' | 'down') => void) | null) => void;
  noteUserGesture: () => void;
}

export const useNavigation = create<NavigationState>((set, get) => ({
  mode: 'app',
  activeAppId: '',
  activeInstanceId: null,
  appOrder: [],
  transitionDirection: null,
  verticalSwipeCallback: null,
  lastGestureMs: 0,

  initApps: () => {
    const ids = getAppIds();
    set({ appOrder: ids, activeAppId: ids[0] || '' });
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
  finishTransition: () => set({ mode: 'app', transitionDirection: null }),
  setVerticalSwipeCallback: (fn) => set({ verticalSwipeCallback: fn }),
  noteUserGesture: () => set({ lastGestureMs: Date.now() }),
}));

// Expose for debugging in dev
if (import.meta.env.DEV) {
  (window as unknown as { __nav: typeof useNavigation }).__nav = useNavigation;
}
