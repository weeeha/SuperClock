import { create } from 'zustand';
import { getAppIds } from './registry';

export type NavMode = 'app' | 'grid' | 'transitioning';

interface NavigationState {
  mode: NavMode;
  activeAppId: string;
  appOrder: string[];
  transitionDirection: 'left' | 'right' | null;

  // Actions
  initApps: () => void;
  switchToApp: (id: string) => void;
  swipeToNext: () => void;
  swipeToPrev: () => void;
  showGrid: () => void;
  hideGrid: () => void;
  finishTransition: () => void;
}

export const useNavigation = create<NavigationState>((set, get) => ({
  mode: 'app',
  activeAppId: '',
  appOrder: [],
  transitionDirection: null,

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

  finishTransition: () => set({ mode: 'app', transitionDirection: null }),
}));

// Expose for debugging in dev
if (import.meta.env.DEV) {
  (window as any).__nav = useNavigation;
}
