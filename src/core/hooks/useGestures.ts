import { useEffect } from 'react';
import { useGesture } from '@use-gesture/react';
import { useNavigation } from '../navigation';

const SWIPE_THRESHOLD = 50;
const SWIPE_VELOCITY = 0.3;
const PINCH_IN_THRESHOLD = 0.85;

export function useAppGestures(containerRef: React.RefObject<HTMLDivElement | null>) {
  // Prevent context menu on long-press
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const prevent = (e: Event) => e.preventDefault();
    el.addEventListener('contextmenu', prevent);
    return () => el.removeEventListener('contextmenu', prevent);
  }, [containerRef]);

  // 3-finger touch — show grid
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const onTouchStart = (e: TouchEvent) => {
      if (e.touches.length >= 3) {
        const { mode, showGrid } = useNavigation.getState();
        if (mode === 'app') showGrid();
      }
    };
    el.addEventListener('touchstart', onTouchStart);
    return () => el.removeEventListener('touchstart', onTouchStart);
  }, [containerRef]);

  useGesture(
    {
      onDragEnd: ({ movement: [mx, my], velocity: [vx, vy] }) => {
        const { mode, swipeToNext, swipeToPrev, showGrid, hideGrid } = useNavigation.getState();
        const absX = Math.abs(mx);
        const absY = Math.abs(my);

        // Vertical swipe — toggle grid
        if (absY > absX && absY > SWIPE_THRESHOLD && Math.abs(vy) > SWIPE_VELOCITY) {
          if (my > 0 && mode === 'app') showGrid();
          else if (my < 0 && mode === 'grid') hideGrid();
          return;
        }

        // Horizontal swipe — switch apps
        if (mode !== 'app') return;
        if (absX < SWIPE_THRESHOLD || Math.abs(vx) < SWIPE_VELOCITY) return;
        if (mx < 0) swipeToNext();
        else swipeToPrev();
      },
      onPinchEnd: ({ offset: [scale] }) => {
        const { mode, showGrid } = useNavigation.getState();
        if (scale < PINCH_IN_THRESHOLD && mode === 'app') showGrid();
      },
    },
    {
      target: containerRef,
      drag: {
        filterTaps: true,
        threshold: 10,
      },
      pinch: {
        scaleBounds: { min: 0.5, max: 2 },
      },
    },
  );
}
