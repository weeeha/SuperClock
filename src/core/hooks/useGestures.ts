import { useEffect, useRef } from 'react';
import { useGesture } from '@use-gesture/react';
import { useNavigation } from '../navigation';
import { classifyTouchStart } from '../gesture-zones';
import type { TouchZone } from '../gesture-zones';
import { resolveDragEnd } from '../gesture-resolve';

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
    // Panic/home per spec: unconditional, from any state — not gated on mode.
    const trigger = () => {
      useNavigation.getState().panicHome();
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

        // Origin zone + live nav state decide exactly one action (pure, tested
        // in gesture-resolve.test.ts). Assigned-arc origins never fall through
        // to app gestures; unclaimed inner vertical is a strict no-op.
        const action = resolveDragEnd(zone, nav.mode, nav.settingsOpen, mx, my, vx, vy, sheetHeight());
        switch (action.type) {
          case 'hideSettings': nav.hideSettings(); break;
          case 'showSettings': nav.showSettings(); break;
          case 'showGrid': nav.showGrid(); break;
          case 'hideGrid': nav.hideGrid(); break;
          case 'back': nav.goBack(); break; // strict no-op when no back callback
          case 'vertical':
            // App-owned; strict no-op when the active app registered nothing.
            if (nav.verticalSwipeCallback) nav.verticalSwipeCallback(action.dir);
            break;
          case 'next': nav.swipeToNext(); break;
          case 'prev': nav.swipeToPrev(); break;
          case 'none': break;
        }
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
