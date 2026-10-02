// Dial maths for setting the timer. One revolution is 60 minutes. The band
// that claims drags runs from 60% of the radius to the inner edge of the
// arc-zone ring, so the outer arcs keep their grammar and a swipe nearer the
// centre still switches apps.
import { RING_FRACTION } from '../../core/gesture-zones';

export const MIN_MS = 30_000;
export const MAX_MS = 60 * 60_000;
export const STEP_MS = 30_000;
export const BAND_INNER_FRACTION = 0.6;

export function snapClamp(ms: number): number {
  const snapped = Math.round(ms / STEP_MS) * STEP_MS;
  return Math.min(MAX_MS, Math.max(MIN_MS, snapped));
}

export function inBand(x: number, y: number, width: number, height: number): boolean {
  const r = Math.min(width, height) / 2;
  const d = Math.hypot(x - width / 2, y - height / 2);
  return d >= r * BAND_INNER_FRACTION && d <= r * (1 - RING_FRACTION);
}

/** The band as an SVG stroke in the 1000-unit disc: r 367.6, width 135.2. */
export function bandCircle(): { r: number; strokeWidth: number } {
  const inner = 500 * BAND_INNER_FRACTION;
  const outer = 500 * (1 - RING_FRACTION);
  return { r: (inner + outer) / 2, strokeWidth: outer - inner };
}

/** Degrees clockwise from 12 o'clock, in [0, 360). */
export function angleFrom12(x: number, y: number, cx: number, cy: number): number {
  return ((Math.atan2(x - cx, -(y - cy)) * 180) / Math.PI + 360) % 360;
}

/** The short way round, so crossing 12 is ±a few degrees, never ±360. */
export function unwrapDelta(fromDeg: number, toDeg: number): number {
  let d = toDeg - fromDeg;
  if (d > 180) d -= 360;
  if (d <= -180) d += 360;
  return d;
}

export function degreesToMs(deg: number): number {
  return (deg / 360) * MAX_MS;
}

export function msToDegrees(ms: number): number {
  return (ms / MAX_MS) * 360;
}
