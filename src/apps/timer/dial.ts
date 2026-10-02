// Dial maths for setting the timer. One revolution is 60 minutes. The band
// geometry is shared with Alarm's ring dial.
export { BAND_INNER_FRACTION, inBand, bandCircle, angleFrom12, unwrapDelta } from '../../core/widgets/dial-geometry';

export const MIN_MS = 30_000;
export const MAX_MS = 60 * 60_000;
export const STEP_MS = 30_000;

export function snapClamp(ms: number): number {
  const snapped = Math.round(ms / STEP_MS) * STEP_MS;
  return Math.min(MAX_MS, Math.max(MIN_MS, snapped));
}

export function degreesToMs(deg: number): number {
  return (deg / 360) * MAX_MS;
}

export function msToDegrees(ms: number): number {
  return (ms / MAX_MS) * 360;
}
