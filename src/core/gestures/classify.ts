// Gesture ownership on a circular screen.
//
// The rule is ORIGIN DECIDES OWNER, evaluated once when the pointer lands:
//
//   1. on an interactive Ring track  -> angular drag (the app's rim control)
//   2. in the outer 15% of the radius -> the shell, by direction
//   3. anywhere else (interior)       -> the app, then app-switching
//
// This is Wear OS's LeftEdgeZoneFraction (0.15) generalised from one edge to
// the whole annulus, which is only possible because a round screen HAS an
// annulus. It replaces the previous model where vertical swipe was owned
// simultaneously by the shell and the active app, arbitrated by whether a
// nullable callback happened to be set — the reason swipe-down silently
// stopped opening the grid on clock, habits and calendar.
//
// Kept pure (no DOM, no store) so every branch is unit-testable.

import { normalizedRadius, sectorAt } from './geometry';
import type { Viewport } from './geometry';

/** Outer fraction of the radius owned by the shell. Matches Wear OS. */
export const EDGE_ZONE = 0.15;
export const SWIPE_THRESHOLD = 50;
export const SWIPE_VELOCITY = 0.3;

export type GestureIntent =
  | { kind: 'none' }
  /** A Ring control claimed the pointer; the shell stays out of the way. */
  | { kind: 'ring' }
  | { kind: 'quick-settings' }
  | { kind: 'grid' }
  | { kind: 'dismiss-overlay' }
  | { kind: 'back' }
  | { kind: 'app-next' }
  | { kind: 'app-prev' }
  | { kind: 'app-vertical'; dir: 'up' | 'down' }
  /** Interior vertical on an app that wants none: bounce toward the edge zone
   *  that would have served it, so the invisible shell zones are learnable. */
  | { kind: 'hint-edge'; edge: 'top' | 'bottom' };

export interface GestureInput {
  /** Client coords where the pointer went down. */
  origin: [number, number];
  /** Net movement over the drag. */
  movement: [number, number];
  velocity: [number, number];
  viewport: Viewport;
  /** Navigation mode at drag start. */
  mode: string;
  /** Whether the active app registered a vertical sub-nav handler. */
  hasVerticalHandler: boolean;
  /** Hit-test result: did the pointer land on an interactive Ring track? */
  onRingTrack: boolean;
}

export function classifyGesture(input: GestureInput): GestureIntent {
  const { origin, movement, velocity, viewport, mode, hasVerticalHandler, onRingTrack } =
    input;

  // 1. Angular drag wins outright. It cannot collide with a linear swipe:
  //    a rim sweep has near-zero net linear movement while covering 90 degrees,
  //    and an app-switch swipe has near-zero angular change. Different
  //    measurements of the same pointer stream.
  if (onRingTrack) return { kind: 'ring' };

  const [mx, my] = movement;
  const [vx, vy] = velocity;
  const absX = Math.abs(mx);
  const absY = Math.abs(my);
  const vertical = absY > absX;

  const farEnough = vertical ? absY > SWIPE_THRESHOLD : absX > SWIPE_THRESHOLD;
  const fastEnough = vertical
    ? Math.abs(vy) > SWIPE_VELOCITY
    : Math.abs(vx) > SWIPE_VELOCITY;
  if (!farEnough || !fastEnough) return { kind: 'none' };

  // 2. An open overlay dismisses with the inverse of the gesture that opened
  //    it — grid comes up from the bottom, so it goes back down.
  if (mode === 'grid') {
    return vertical && my > 0 ? { kind: 'dismiss-overlay' } : { kind: 'none' };
  }
  if (mode === 'quick-settings') {
    return vertical && my < 0 ? { kind: 'dismiss-overlay' } : { kind: 'none' };
  }
  // Mid-transition: swallow everything rather than queue a second switch.
  if (mode !== 'app') return { kind: 'none' };

  // 3. Edge zone — origin sector AND direction must agree.
  const onEdge = normalizedRadius(origin[0], origin[1], viewport) >= 1 - EDGE_ZONE;
  if (onEdge) {
    const sector = sectorAt(origin[0], origin[1], viewport);
    if (sector === 'top' && vertical && my > 0) return { kind: 'quick-settings' };
    if (sector === 'bottom' && vertical && my < 0) return { kind: 'grid' };
    if (sector === 'left' && !vertical && mx > 0) return { kind: 'back' };
    // A mismatched direction falls through to interior behaviour instead of
    // dead-zoning the rim — pulling down on the bottom edge should still do
    // whatever an interior pull-down does.
  }

  // 4. Interior.
  if (vertical) {
    if (hasVerticalHandler) return { kind: 'app-vertical', dir: my > 0 ? 'down' : 'up' };
    // Point at the edge that owns what they were reaching for: swiping down
    // wants quick settings (top edge), swiping up wants the grid (bottom).
    return { kind: 'hint-edge', edge: my > 0 ? 'top' : 'bottom' };
  }
  return mx < 0 ? { kind: 'app-next' } : { kind: 'app-prev' };
}
