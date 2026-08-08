// src/core/gesture-resolve.ts
// Pure drag-end decision function for the root gesture handler.
// Extracted so the branchy classification can be unit-tested without React or
// @use-gesture (the handler in useGestures.ts is otherwise all closure).
//
// Spec: docs/specs/2026-07-24-kiosk-navigation-gestures-spec.md — a gesture is
// classified by its ORIGIN zone at drag start (gesture-zones.ts) and resolved
// to exactly one action here. An assigned-arc origin OWNS its gesture: it never
// falls through to inner app behavior (sub-threshold = snap-back no-op).

import type { NavMode } from './navigation';
import type { TouchZone } from './gesture-zones';
import { ARC_MIN_TRAVEL, COMMIT_PROGRESS } from './gesture-zones';

export const SWIPE_THRESHOLD = 50;
export const SWIPE_VELOCITY = 0.3;

export type DragAction =
  | { type: 'none' }
  | { type: 'hideSettings' }
  | { type: 'showSettings' }
  | { type: 'showGrid' }
  | { type: 'hideGrid' }
  | { type: 'back' }
  | { type: 'vertical'; dir: 'up' | 'down' }
  | { type: 'next' }
  | { type: 'prev' };

/** Decide the single action a completed drag maps to. Pure — the caller reads
 *  live nav state, passes it in, and dispatches the returned tag. */
export function resolveDragEnd(
  zone: TouchZone,
  mode: NavMode,
  settingsOpen: boolean,
  mx: number,
  my: number,
  vx: number,
  vy: number,
  sheetH: number,
): DragAction {
  // ---- Settings open: only dismissal gestures exist ----
  if (settingsOpen) {
    return my > SWIPE_THRESHOLD ? { type: 'hideSettings' } : { type: 'none' };
  }

  const absX = Math.abs(mx);
  const absY = Math.abs(my);
  const isVerticalSwipe =
    absY > absX && absY > SWIPE_THRESHOLD && Math.abs(vy) > SWIPE_VELOCITY;

  // ---- Grid open: swipe-up dismisses from ANY origin (incl. arcs) ----
  // Full-screen overlay ⇒ no rim-misfire risk; keeps the established gesture.
  if (mode === 'grid') {
    return isVerticalSwipe && my < 0 ? { type: 'hideGrid' } : { type: 'none' };
  }

  // ---- Arc gestures (system) — app mode, origin-in-arc + inward travel ≥ 80px ----
  if (mode === 'app' && zone === 'bottom-arc' && -my >= ARC_MIN_TRAVEL) {
    return -my / sheetH >= COMMIT_PROGRESS ? { type: 'showSettings' } : { type: 'none' };
  }
  if (mode === 'app' && zone === 'top-arc' && my >= ARC_MIN_TRAVEL) {
    return { type: 'showGrid' };
  }
  if (mode === 'app' && zone === 'left-arc' && mx >= ARC_MIN_TRAVEL) {
    return { type: 'back' }; // strict no-op downstream when no back callback
  }

  // An assigned-arc origin owns its gesture: sub-threshold = snap-back no-op,
  // never an app gesture (spec: one gesture, one outcome). Only inner and the
  // unassigned right arc reach the app branches below.
  if (zone !== 'inner' && zone !== 'right-arc') return { type: 'none' };

  // ---- Inner vertical: app-owned or STRICT NO-OP (spec decision 2a) ----
  if (isVerticalSwipe) {
    return mode === 'app' ? { type: 'vertical', dir: my > 0 ? 'down' : 'up' } : { type: 'none' };
  }

  // ---- Inner horizontal: switch apps ----
  if (mode !== 'app') return { type: 'none' };
  if (absX < SWIPE_THRESHOLD || Math.abs(vx) < SWIPE_VELOCITY) return { type: 'none' };
  return mx < 0 ? { type: 'next' } : { type: 'prev' };
}
