import { create } from 'zustand';
import { getAppIds } from './registry';

export type NavMode = 'app' | 'grid' | 'settings' | 'transitioning';

interface NavigationState {
  mode: NavMode;
  activeAppId: string;
  appOrder: string[];
  transitionDirection: 'left' | 'right' | null;
  verticalSwipeCallback: ((dir: 'up' | 'down') => void) | null;

  // Actions
  initApps: () => void;
  switchToApp: (id: string) => void;
  swipeToNext: () => void;
  swipeToPrev: () => void;
  showGrid: () => void;
  hideGrid: () => void;
  showSettings: () => void;
  hideSettings: () => void;
  finishTransition: () => void;
  setVerticalSwipeCallback: (fn: ((dir: 'up' | 'down') => void) | null) => void;
}

export const useNavigation = create<NavigationState>((set, get) => ({
  mode: 'app',
  activeAppId: '',
  appOrder: [],
  transitionDirection: null,
  verticalSwipeCallback: null,

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
      transitionDirection: 'right',
    });
  },

  swipeToNext: () => {
    const { appOrder, activeAppId } = get();
    const idx = appOrder.indexOf(activeAppId);
    const nextIdx = (idx + 1) % appOrder.length;
    set({
      mode: 'transitioning',
      activeAppId: appOrder[nextIdx],
      transitionDirection: 'left',
    });
  },

  swipeToPrev: () => {
    const { appOrder, activeAppId } = get();
    const idx = appOrder.indexOf(activeAppId);
    const prevIdx = (idx - 1 + appOrder.length) % appOrder.length;
    set({
      mode: 'transitioning',
      activeAppId: appOrder[prevIdx],
      transitionDirection: 'right',
    });
  },

  showGrid: () => set({ mode: 'grid' }),
  hideGrid: () => set({ mode: 'app' }),
  showSettings: () => set({ mode: 'settings' }),
  hideSettings: () => set({ mode: 'app' }),
  finishTransition: () => set({ mode: 'app', transitionDirection: null }),
  setVerticalSwipeCallback: (fn) => set({ verticalSwipeCallback: fn }),
}));

// Expose for debugging in dev
if (import.meta.env.DEV) {
  (window as any).__nav = useNavigation;
}
