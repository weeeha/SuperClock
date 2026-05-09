import { useEffect } from 'react';
import { useGesture } from '@use-gesture/react';
import { useNavigation } from '../navigation';

const SWIPE_THRESHOLD = 50;
const SWIPE_VELOCITY = 0.3;
const LONG_PRESS_MS = 700;
const LONG_PRESS_MOVE_TOLERANCE = 12;

export function useAppGestures(containerRef: React.RefObject<HTMLDivElement | null>) {
  // Prevent context menu on long-press
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const prevent = (e: Event) => e.preventDefault();
    el.addEventListener('contextmenu', prevent);
    return () => el.removeEventListener('contextmenu', prevent);
  }, [containerRef]);

  // Long-press anywhere — opens the grid. Single-touch only, so it works
  // on this hardware where multi-touch isn't reaching the browser.
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    let timer: number | null = null;
    let startX = 0;
    let startY = 0;
    const cancel = () => {
      if (timer !== null) {
        window.clearTimeout(timer);
        timer = null;
      }
    };
    const onPointerDown = (e: PointerEvent) => {
      if (!e.isPrimary) return;
      cancel();
      startX = e.clientX;
      startY = e.clientY;
      timer = window.setTimeout(() => {
        timer = null;
        const { mode, showGrid } = useNavigation.getState();
        if (mode === 'app') showGrid();
      }, LONG_PRESS_MS);
    };
    const onPointerMove = (e: PointerEvent) => {
      if (timer === null) return;
      if (Math.hypot(e.clientX - startX, e.clientY - startY) > LONG_PRESS_MOVE_TOLERANCE) cancel();
    };
    el.addEventListener('pointerdown', onPointerDown);
    el.addEventListener('pointermove', onPointerMove);
    el.addEventListener('pointerup', cancel);
    el.addEventListener('pointercancel', cancel);
    return () => {
      cancel();
      el.removeEventListener('pointerdown', onPointerDown);
      el.removeEventListener('pointermove', onPointerMove);
      el.removeEventListener('pointerup', cancel);
      el.removeEventListener('pointercancel', cancel);
    };
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
    },
    {
      target: containerRef,
      drag: {
        filterTaps: true,
        threshold: 10,
      },
    },
  );
}
