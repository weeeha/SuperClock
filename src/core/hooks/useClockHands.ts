import { useEffect, useState } from 'react';

export interface ClockHands {
  /** Current time snapshot — for digital readouts, day/date labels, timezone math. */
  time: Date;
  hourDeg: number;
  minuteDeg: number;
  /**
   * Monotonically increasing rotation, NOT reduced mod 360. A plain `seconds * 6`
   * resets 354°→0° every minute, and the faces' `transition: transform` then
   * animates that drop as a full backwards sweep. Driving the angle from a
   * continuously increasing source keeps the wrap going forward (354°→360°).
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
    secondDeg: Math.floor(time.getTime() / 1000) * 6,
  };
}
