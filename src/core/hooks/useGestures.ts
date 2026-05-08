import { useEffect, useRef } from 'react';
import { useGesture } from '@use-gesture/react';
import { useNavigation } from '../navigation';

const SWIPE_THRESHOLD = 50;
const SWIPE_VELOCITY = 0.3;
const PINCH_IN_THRESHOLD = 0.9;

export function useAppGestures(containerRef: React.RefObject<HTMLDivElement | null>) {
  // Prevent context menu on long-press
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const prevent = (e: Event) => e.preventDefault();
    el.addEventListener('contextmenu', prevent);
    return () => el.removeEventListener('contextmenu', prevent);
  }, [containerRef]);

  // 3-finger touch — track active touch pointers (more reliable than touchstart on Chromium/Pi)
  useEffect(() => {
    const active = new Set<number>();
    const onPointerDown = (e: PointerEvent) => {
      if (e.pointerType !== 'touch') return;
      active.add(e.pointerId);
      if (active.size >= 3) {
        const { mode, showGrid } = useNavigation.getState();
        if (mode === 'app') showGrid();
      }
    };
    const onPointerEnd = (e: PointerEvent) => {
      active.delete(e.pointerId);
    };
    window.addEventListener('pointerdown', onPointerDown);
    window.addEventListener('pointerup', onPointerEnd);
    window.addEventListener('pointercancel', onPointerEnd);
    return () => {
      window.removeEventListener('pointerdown', onPointerDown);
      window.removeEventListener('pointerup', onPointerEnd);
      window.removeEventListener('pointercancel', onPointerEnd);
    };
  }, []);

  // Fires once per pinch gesture so we don't re-trigger while fingers are still down
  const pinchFired = useRef(false);

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
      onPinchStart: () => {
        pinchFired.current = false;
      },
      onPinch: ({ offset: [scale] }) => {
        if (pinchFired.current) return;
        if (scale < PINCH_IN_THRESHOLD) {
          const { mode, showGrid } = useNavigation.getState();
          if (mode === 'app') showGrid();
          pinchFired.current = true;
        }
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
