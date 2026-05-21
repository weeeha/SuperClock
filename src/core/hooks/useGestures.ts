import { useEffect, useRef } from 'react';
import { useGesture } from '@use-gesture/react';
import { useNavigation } from '../navigation';

const SWIPE_THRESHOLD = 50;
const SWIPE_VELOCITY = 0.3;
const PINCH_IN_THRESHOLD = 0.9;
// Edge zone (px) — vertical swipes that START inside this zone are treated
// as system gestures (show menu / settings). Swipes that start mid-screen
// pass through so apps can scroll. Tune this for touch panel reachability.
const EDGE_PX = 40;

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

  // Captures the pointer's starting Y so we can detect edge-originated swipes
  // (iOS style: only swipes that start at the screen edge open system menus)
  const startY = useRef(0);

  useGesture(
    {
      onDragStart: ({ xy: [, y] }) => {
        startY.current = y;
      },
      onDragEnd: ({ movement: [mx, my], velocity: [vx, vy] }) => {
        const { mode, swipeToNext, swipeToPrev, showGrid, hideGrid, showSettings, hideSettings } =
          useNavigation.getState();
        const absX = Math.abs(mx);
        const absY = Math.abs(my);

        // Vertical swipe
        if (absY > absX && absY > SWIPE_THRESHOLD && Math.abs(vy) > SWIPE_VELOCITY) {
          const startedNearTop = startY.current < EDGE_PX;
          const startedNearBottom = startY.current > window.innerHeight - EDGE_PX;
          const swipingUp = my < 0;
          const swipingDown = my > 0;

          if (mode === 'app') {
            // System gestures only fire when starting at an edge — mid-screen
            // vertical swipes are ignored so apps can use them.
            if (swipingUp && startedNearBottom) showGrid();
            else if (swipingDown && startedNearTop) showSettings();
          } else if (mode === 'grid' && swipingDown) {
            // Grid came up from bottom — swipe it back down to dismiss
            hideGrid();
          } else if (mode === 'settings' && swipingUp) {
            // Settings came down from top — swipe it back up to dismiss
            hideSettings();
          }
          return;
        }

        // Horizontal swipe — switch apps (only in app mode)
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
