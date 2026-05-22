/**
 * Geometric clock-hand endpoints.
 *
 * Given an angle (0° = 12 o'clock, increasing clockwise), returns the SVG line
 * endpoints for a hand extending `tipLen` toward the tip and `tailLen` behind
 * the centre, within the 1000×1000 viewBox.
 *
 * Hands are drawn by computing coordinates rather than via `transform: rotate()`
 * with a CSS `transition`. That matters: the angle stays in JS float64 trig (no
 * compositor float32 matrix, so no large-angle jump) and there is no transition
 * to interpolate the minute wrap backwards. Both historical second-hand bugs are
 * impossible by construction.
 */
export function handPoints(
  angleDeg: number,
  tipLen: number,
  tailLen = 0,
  cx = 500,
  cy = 500,
): { x1: number; y1: number; x2: number; y2: number } {
  const rad = (angleDeg * Math.PI) / 180;
  const sin = Math.sin(rad);
  const cos = Math.cos(rad);
  return {
    x1: cx - tailLen * sin,
    y1: cy + tailLen * cos,
    x2: cx + tipLen * sin,
    y2: cy - tipLen * cos,
  };
}
