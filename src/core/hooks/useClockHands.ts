import { useEffect, useState } from 'react';

// Captured once when this module first loads (≈ page load on the kiosk). The
// second-hand angle is derived relative to this so it increases continuously —
// never resetting 354°→0° (which makes the CSS transition sweep the hand
// backward) — while staying numerically SMALL. An absolute epoch angle
// (Math.floor(Date.now()/1000)*6 ≈ 1e10°) loses ~150° to float32 precision in
// the compositor's transform matrix, so the hand quantizes and jumps. Kiosk
// Chromium is recycled every 6h, so this stays under ~130k° (float32-safe).
const MOUNT_SEC = Math.floor(Date.now() / 1000);
const MOUNT_ANGLE = (MOUNT_SEC % 60) * 6;

export interface ClockHands {
  /** Current time snapshot — for digital readouts, day/date labels, timezone math. */
  time: Date;
  hourDeg: number;
  minuteDeg: number;
  /**
   * Continuously increasing rotation in degrees, relative to module mount — NOT
   * reset mod 360. A plain `seconds * 6` resets 354°→0° each minute and the faces'
   * `transition: transform` then sweeps the hand backward. This keeps the wrap
   * going forward (354°→360°) while staying small enough for the compositor's
   * float32 transform matrix (bounded by page uptime, not absolute epoch).
   */
  secondDeg: number;
}

/**
 * Single source of truth for analog clock-hand angles.
 *
 * Owns the per-second tick (gated on `isActive` so backgrounded faces stop ticking,
 * per the active-aware convention) and derives the three hand rotations. Every
 * watch face must consume this rather than recomputing angles inline — an ESLint
 * guard forbids `setInterval` inside `src/apps/clock` to keep it that way.
 */
export function useClockHands(isActive: boolean, tickMs = 1000): ClockHands {
  const [time, setTime] = useState(() => new Date());

  useEffect(() => {
    if (!isActive) return;
    const id = setInterval(() => setTime(new Date()), tickMs);
    return () => clearInterval(id);
  }, [isActive, tickMs]);

  const hours = time.getHours() % 12;
  const minutes = time.getMinutes();
  const seconds = time.getSeconds();

  return {
    time,
    hourDeg: hours * 30 + minutes * 0.5,
    minuteDeg: minutes * 6 + seconds * 0.1,
    secondDeg: MOUNT_ANGLE + (Math.floor(time.getTime() / 1000) - MOUNT_SEC) * 6,
  };
}
