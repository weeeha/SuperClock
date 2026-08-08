import { useEffect, useRef } from 'react';
import { useGesture } from '@use-gesture/react';
import { useNavigation } from '../navigation';
import { classifyGesture } from '../gestures/classify';
import type { GestureIntent } from '../gestures/classify';

const PINCH_IN_THRESHOLD = 0.9;

/** Elements marked with this attribute claim angular drag (the Ring primitive). */
const RING_TRACK_SELECTOR = '[data-ring-track]';

/** Snapshotted at drag start — ownership must not change mid-gesture. */
interface DragOrigin {
  origin: [number, number];
  mode: string;
  hasVerticalHandler: boolean;
  onRingTrack: boolean;
}

function hitTestRingTrack(x: number, y: number): boolean {
  if (typeof document === 'undefined') return false;
  const el = document.elementFromPoint(x, y);
  return !!el?.closest(RING_TRACK_SELECTOR);
}

function dispatch(intent: GestureIntent) {
  const nav = useNavigation.getState();
  switch (intent.kind) {
    case 'quick-settings':
      nav.showQuickSettings();
      break;
    case 'grid':
      nav.showGrid();
      break;
    case 'dismiss-overlay':
      nav.dismissOverlay();
      break;
    case 'back':
      nav.goBack();
      break;
    case 'app-next':
      nav.swipeToNext();
      break;
    case 'app-prev':
      nav.swipeToPrev();
      break;
    case 'app-vertical': {
      // An app can own vertical without owning both directions. When it
      // declines, fall back to the hint rather than swallowing the gesture.
      const handled = nav.verticalSwipeCallback?.(intent.dir);
      if (handled === false) nav.flashEdgeHint(intent.dir === 'down' ? 'top' : 'bottom');
      else nav.noteUserGesture();
      break;
    }
    case 'hint-edge':
      nav.flashEdgeHint(intent.edge);
      break;
    case 'ring':
    case 'none':
      break;
  }
}

export function useAppGestures(containerRef: React.RefObject<HTMLDivElement | null>) {
  // Prevent context menu on long-press
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const prevent = (e: Event) => e.preventDefault();
    el.addEventListener('contextmenu', prevent);
    return () => el.removeEventListener('contextmenu', prevent);
  }, [containerRef]);

  // 3-finger touch — listen on BOTH pointer and touch event channels in capture
  // phase so use-gesture can't swallow them, plus update a debug overlay.
  useEffect(() => {
    const active = new Set<number>();
    const trigger = () => {
      const { mode, showGrid } = useNavigation.getState();
      if (mode === 'app') showGrid();
    };
    const onPointerDown = (e: PointerEvent) => {
      active.add(e.pointerId);
      if (active.size >= 3) trigger();
    };
    const onPointerEnd = (e: PointerEvent) => {
      active.delete(e.pointerId);
    };
    const onTouchStart = (e: TouchEvent) => {
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
  const dragStart = useRef<DragOrigin | null>(null);

  useGesture(
    {
      // Continuous rather than onDragEnd-only: ownership is decided from the
      // pointer-down position, which onDragEnd cannot see, and Ring controls
      // will need to track the finger live.
      onDrag: ({ first, last, initial, movement, velocity }) => {
        if (first) {
          const [ox, oy] = initial;
          const { mode, verticalSwipeCallback } = useNavigation.getState();
          dragStart.current = {
            origin: [ox, oy],
            mode,
            hasVerticalHandler: !!verticalSwipeCallback,
            onRingTrack: hitTestRingTrack(ox, oy),
          };
        }
        if (!last) return;

        const start = dragStart.current;
        dragStart.current = null;
        if (!start) return;

        const intent = classifyGesture({
          origin: start.origin,
          movement,
          velocity,
          viewport: { width: window.innerWidth, height: window.innerHeight },
          mode: start.mode,
          hasVerticalHandler: start.hasVerticalHandler,
          onRingTrack: start.onRingTrack,
        });

        if (import.meta.env.DEV) {
          const debug = document.getElementById('gesture-debug');
          if (debug) {
            debug.textContent = `${Math.round(start.origin[0])},${Math.round(
              start.origin[1],
            )} -> ${intent.kind}`;
          }
        }

        dispatch(intent);
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
