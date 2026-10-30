// Tonearm geometry for the Vinyl face, in the 1000-unit render space.
//
// The shader paints only the record (radius 440, grooves from 129 to 425 of
// 1000); the arm is drawn by React on top so it reads the ink role and can be
// driven by the clock. One side plays per hour: the needle lands on the
// lead-in groove at :00 and reaches the run-out just before the hour turns.
// A real arm pivots at a fixed point and its needle traces an arc across the
// grooves, so the needle is the intersection of the groove circle with the
// circle of arm length around the pivot (law of cosines), never a point
// slid along a radius.
//
// The pivot sits off the record the way a deck's does, at the Technics
// SL-1200 ratios scaled to this record (pivot 215 mm from the spindle, arm
// 230 mm, record radius 150 mm): outside the 1080 disc, so the arm enters
// from under the top-right bezel and its needle lands at four o'clock on the
// lead-in and curves toward five as it plays in. Nothing load-bearing is
// outside the disc: the needle, which tells the minute, stays inside for
// every minute (vinyl-geometry.test.ts).

const CX = 500;
const CY = 500;

export const ARM = {
  pivot: { x: 945, y: 55 },
  length: 674,
  /** Outer groove radius: the shader's grooveOuter, 0.425 of the space. */
  leadIn: 425,
  /** Inner groove radius: the shader's grooveInner, 0.129 of the space. */
  runOut: 130,
} as const;

/** Groove radius under the needle for a minute of the hour (0 to 60). */
export function needleRadius(minute: number): number {
  const t = Math.min(Math.max(minute, 0), 60) / 60;
  return ARM.leadIn - (ARM.leadIn - ARM.runOut) * t;
}

/** Radii the arm can reach: |d - L| to d + L for pivot distance d. */
export function armReach(): { min: number; max: number } {
  const d = Math.hypot(ARM.pivot.x - CX, ARM.pivot.y - CY);
  return { min: Math.abs(d - ARM.length), max: d + ARM.length };
}

/** Needle position for a groove radius: on that circle around the spindle and
 *  at arm length from the pivot, on the side that puts the needle at the lower
 *  right of the record the way a deck's headshell sits. */
export function needlePoint(radius: number): { x: number; y: number } {
  const dx = ARM.pivot.x - CX;
  const dy = ARM.pivot.y - CY;
  const d = Math.hypot(dx, dy);
  const cos = (d * d + radius * radius - ARM.length * ARM.length) / (2 * d * radius);
  const theta = Math.acos(Math.min(1, Math.max(-1, cos)));
  const base = Math.atan2(dy, dx);
  const a = base + theta;
  return { x: CX + radius * Math.cos(a), y: CY + radius * Math.sin(a) };
}
