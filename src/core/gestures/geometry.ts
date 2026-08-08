// Polar geometry for the circular viewport.
//
// This is the single source of truth for turning screen coordinates into
// (angle, radius) and back. Gesture classification uses it to decide who owns
// a pointer; the Ring primitive uses it to place content on the annulus.
// Before this existed the same trig was hand-rolled in six places
// (fitness, time-tracking, claude-usage, habits, productivity, complications).

export interface Viewport {
  width: number;
  height: number;
}

/** Radius of the largest circle inscribed in the viewport. */
export function inscribedRadius(v: Viewport): number {
  return Math.min(v.width, v.height) / 2;
}

export function centerOf(v: Viewport): [number, number] {
  return [v.width / 2, v.height / 2];
}

/**
 * Distance from centre as a fraction of the inscribed radius: 0 = dead centre,
 * 1 = on the rim. Exceeds 1 outside the inscribed circle, which only happens on
 * a non-square viewport (the letterboxed 800x480 device).
 */
export function normalizedRadius(x: number, y: number, v: Viewport): number {
  const r = inscribedRadius(v);
  if (r === 0) return 0;
  const [cx, cy] = centerOf(v);
  return Math.hypot(x - cx, y - cy) / r;
}

/**
 * Angle from 12 o'clock, clockwise, in degrees [0, 360).
 * Screen y grows downward, hence the negated dy.
 */
export function angleAt(x: number, y: number, v: Viewport): number {
  const [cx, cy] = centerOf(v);
  const deg = (Math.atan2(x - cx, -(y - cy)) * 180) / Math.PI;
  return (deg + 360) % 360;
}

export type Sector = 'top' | 'right' | 'bottom' | 'left';

/** Which 90-degree sector — centred on 12/3/6/9 o'clock — a point falls in. */
export function sectorAt(x: number, y: number, v: Viewport): Sector {
  const a = angleAt(x, y, v);
  if (a >= 315 || a < 45) return 'top';
  if (a < 135) return 'right';
  if (a < 225) return 'bottom';
  return 'left';
}

/**
 * Cartesian point at (angle from 12 o'clock, radius), relative to (cx, cy).
 * The inverse of angleAt — and the core of the Ring primitive.
 */
export function fromPolar(
  angleDeg: number,
  radius: number,
  cx = 0,
  cy = 0,
): [number, number] {
  const rad = ((angleDeg - 90) * Math.PI) / 180;
  return [cx + radius * Math.cos(rad), cy + radius * Math.sin(rad)];
}

/**
 * Shortest signed angular delta from `a` to `b`, in (-180, 180].
 * Angular drag accumulates these so a sweep across 12 o'clock (359° -> 1°)
 * reads as +2°, not -358°.
 */
export function angleDelta(a: number, b: number): number {
  return ((((b - a) % 360) + 540) % 360) - 180;
}
