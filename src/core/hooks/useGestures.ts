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

  // 3-finger touch — listen on BOTH pointer and touch event channels in capture phase
  // so use-gesture can't swallow them, plus update a debug overlay.
  useEffect(() => {
    const active = new Set<number>();
    const debug = document.getElementById('gesture-debug');
    const updateDebug = (label: string) => {
      if (debug) debug.textContent = `${label}: ptr=${active.size}`;
    };
    const trigger = () => {
      const { mode, showGrid } = useNavigation.getState();
      if (mode === 'app') showGrid();
    };
    const onPointerDown = (e: PointerEvent) => {
      active.add(e.pointerId);
      updateDebug('pd');
      if (active.size >= 3) trigger();
    };
    const onPointerEnd = (e: PointerEvent) => {
      active.delete(e.pointerId);
      updateDebug('pu');
    };
    const onTouchStart = (e: TouchEvent) => {
      updateDebug(`ts(${e.touches.length})`);
      if (e.touches.length >= 3) trigger();
    };
    window.addEventListener('pointerdown', onPointerDown, { capture: true });
    window.addEventListener('pointerup', onPointerEnd, { capture: true });
    window.addEventListener('pointercancel', onPointerEnd, { capture: true });
    window.addEventListener('touchstart', onTouchStart, { capture: true, passive: true });
    return () => {
      window.removeEventListener('pointerdown', onPointerDown, { capture: true });
      window.removeEventListener('pointerup', onPointerEnd, { capture: true });
      window.removeEventListener('pointercancel', onPointerEnd, { capture: true });
      window.removeEventListener('touchstart', onTouchStart, { capture: true });
    };
  }, []);

  // Fires once per pinch gesture so we don't re-trigger while fingers are still down
  const pinchFired = useRef(false);

  useGesture(
    {
      onDragEnd: ({ movement: [mx, my], velocity: [vx, vy] }) => {
        const { mode, swipeToNext, swipeToPrev, showGrid, hideGrid, verticalSwipeCallback } = useNavigation.getState();
        const absX = Math.abs(mx);
        const absY = Math.abs(my);

        // Vertical swipe — delegate to active app or toggle grid
        if (absY > absX && absY > SWIPE_THRESHOLD && Math.abs(vy) > SWIPE_VELOCITY) {
          if (mode === 'app' && verticalSwipeCallback) {
            verticalSwipeCallback(my > 0 ? 'down' : 'up');
          } else if (my > 0 && mode === 'app') {
            showGrid();
          } else if (my < 0 && mode === 'grid') {
            hideGrid();
          }
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
