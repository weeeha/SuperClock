import { useEffect, useRef } from 'react';
import { useGesture } from '@use-gesture/react';
import { useNavigation } from '../navigation';
import { classifyTouchStart, ARC_MIN_TRAVEL, COMMIT_PROGRESS } from '../gesture-zones';
import type { TouchZone } from '../gesture-zones';

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

  // Zone is decided at drag START (spec: origin owns the gesture) and
  // consumed at drag end. Ref, not state — gestures must not re-render.
  const zoneRef = useRef<TouchZone>('inner');
  // Sheet height the peek progress is measured against (half the disc).
  const sheetHeight = () => window.innerHeight / 2;

  useGesture(
    {
      onDragStart: ({ xy: [x, y] }) => {
        zoneRef.current = classifyTouchStart(x, y, window.innerWidth, window.innerHeight);
      },
      onDrag: ({ movement: [, my] }) => {
        const { mode, settingsOpen, setPeek } = useNavigation.getState();
        if (mode !== 'app' || settingsOpen) return;
        // Peek-follow: bottom arc drags the settings sheet up with the finger.
        if (zoneRef.current === 'bottom-arc' && my < 0) {
          setPeek({ target: 'settings', progress: Math.min(1, -my / sheetHeight()) });
        }
      },
      onDragEnd: ({ movement: [mx, my], velocity: [vx, vy] }) => {
        const nav = useNavigation.getState();
        const zone = zoneRef.current;
        zoneRef.current = 'inner';
        nav.setPeek(null);

        // ---- Settings open: only dismissal gestures exist ----
        if (nav.settingsOpen) {
          if (my > SWIPE_THRESHOLD) nav.hideSettings(); // swipe down dismisses
          return;
        }

        // ---- Arc gestures (system) — origin-in-arc + inward travel >= 80px ----
        if (nav.mode === 'app' && zone === 'bottom-arc' && -my >= ARC_MIN_TRAVEL) {
          if (-my / sheetHeight() >= COMMIT_PROGRESS) nav.showSettings();
          return; // sub-threshold = snap back (peek already cleared)
        }
        if (nav.mode === 'app' && zone === 'top-arc' && my >= ARC_MIN_TRAVEL) {
          nav.showGrid();
          return;
        }
        if (nav.mode === 'app' && zone === 'left-arc' && mx >= ARC_MIN_TRAVEL) {
          nav.goBack(); // strict no-op when no app registered a back callback
          return;
        }
        // right-arc: unassigned — falls through to inner behavior below.

        const absX = Math.abs(mx);
        const absY = Math.abs(my);

        // ---- Inner vertical: app-owned or STRICT NO-OP (spec decision 2a) ----
        if (absY > absX && absY > SWIPE_THRESHOLD && Math.abs(vy) > SWIPE_VELOCITY) {
          if (nav.mode === 'app' && nav.verticalSwipeCallback) {
            nav.verticalSwipeCallback(my > 0 ? 'down' : 'up');
          } else if (my < 0 && nav.mode === 'grid') {
            nav.hideGrid(); // grid dismissal keeps its swipe-up
          }
          // NO else-showGrid: unclaimed vertical is a no-op now. The grid is
          // reachable via top arc, 3-finger tap, and (kept) pinch-in.
          return;
        }

        // ---- Inner horizontal: switch apps (unchanged) ----
        if (nav.mode !== 'app') return;
        if (absX < SWIPE_THRESHOLD || Math.abs(vx) < SWIPE_VELOCITY) return;
        if (mx < 0) nav.swipeToNext();
        else nav.swipeToPrev();
      },
      onPinchStart: () => {
        pinchFired.current = false;
      },
      onPinch: ({ movement: [dScale] }) => {
        if (pinchFired.current) return;
        // movement is per-gesture (offset is cumulative across gestures and
        // would instantly re-trigger every pinch after the first pinch-in).
        if (dScale < -(1 - PINCH_IN_THRESHOLD)) {
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
