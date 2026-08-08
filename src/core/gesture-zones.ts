// src/core/gesture-zones.ts
// Pure touch-start classification for the round kiosk viewport.
// Spec: docs/specs/2026-07-24-kiosk-navigation-gestures-spec.md — an outer
// ring (~70px of 1080, expressed as a fraction so it scales in dev windows)
// splits into 90° arcs at 12 / 6 / 9 o'clock. Classification happens at drag
// START; the right arc is unassigned and falls through to inner behavior at
// the gesture layer.

export type TouchZone = 'inner' | 'top-arc' | 'bottom-arc' | 'left-arc' | 'right-arc';

/** Ring width as a fraction of the disc radius (70/540). Tune on hardware. */
export const RING_FRACTION = 70 / 540;

/** Minimum inward travel (px at 1080) before an arc gesture may commit. */
export const ARC_MIN_TRAVEL = 80;

/** Peek progress (0..1 of sheet height) past which an arc gesture commits. */
export const COMMIT_PROGRESS = 0.4;

export function classifyTouchStart(
  x: number,
  y: number,
  width: number,
  height: number,
): TouchZone {
  const cx = width / 2;
  const cy = height / 2;
  const radius = Math.min(width, height) / 2;
  const dx = x - cx;
  const dy = y - cy;
  const dist = Math.hypot(dx, dy);

  if (dist <= radius * (1 - RING_FRACTION)) return 'inner';

  // Angle from 12 o'clock, clockwise, in degrees [0, 360).
  const deg = ((Math.atan2(dx, -dy) * 180) / Math.PI + 360) % 360;

  if (deg >= 315 || deg < 45) return 'top-arc';
  if (deg < 135) return 'right-arc';
  if (deg < 225) return 'bottom-arc';
  return 'left-arc';
}
