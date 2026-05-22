import { useEffect, useState } from 'react';

// Captured once at module load. Used ONLY by the tick path while faces still
// render via `transform: rotate()` + a CSS transition: the second-hand angle is
// derived relative to here so it increases continuously (never resetting 354°→0°,
// which would sweep the hand backward) while staying numerically small (an
// absolute epoch angle ≈1e10° loses ~150° to the compositor's float32 transform
// matrix and jumps). Faces migrated to geometric handPoints() rendering don't
// need this — trig runs in JS float64 and there's no transition.
const MOUNT_SEC = Math.floor(Date.now() / 1000);
const MOUNT_ANGLE = (MOUNT_SEC % 60) * 6;

export interface ClockHands {
  /** Current time snapshot — for digital readouts, day/date labels, timezone math. */
  time: Date;
  hourDeg: number;
  minuteDeg: number;
  /** Second-hand angle in degrees (bounded; safe for geometric and legacy transform rendering). */
  secondDeg: number;
}

export interface ClockHandsOptions {
  /**
   * Smooth sweep instead of a once-per-second tick: drives updates with
   * requestAnimationFrame (throttled ~30fps for the Pi) and folds the sub-second
   * fraction into the angles so the second hand glides. Off by default (tick).
   */
  sweep?: boolean;
}

/**
 * Single source of truth for analog clock-hand angles.
 *
 * Owns the time updates (gated on `isActive` so backgrounded faces stop ticking)
 * and derives the three hand rotations. Every watch face must consume this rather
 * than recomputing angles inline — an ESLint guard forbids `setInterval` inside
 * `src/apps/clock` to keep it that way.
 */
export function useClockHands(isActive: boolean, options: ClockHandsOptions = {}): ClockHands {
  const { sweep = false } = options;
  const [time, setTime] = useState(() => new Date());

  useEffect(() => {
    if (!isActive) return;
    if (sweep) {
      let raf = 0;
      let last = 0;
      const loop = (t: number) => {
        if (t - last >= 33) {
          setTime(new Date());
          last = t;
        }
        raf = requestAnimationFrame(loop);
      };
      raf = requestAnimationFrame(loop);
      return () => cancelAnimationFrame(raf);
    }
    const id = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(id);
  }, [isActive, sweep]);

  const hours = time.getHours() % 12;
  const minutes = time.getMinutes();
  const seconds = sweep ? time.getSeconds() + time.getMilliseconds() / 1000 : time.getSeconds();

  return {
    time,
    hourDeg: hours * 30 + minutes * 0.5,
    minuteDeg: minutes * 6 + seconds * 0.1,
    secondDeg: sweep
      ? seconds * 6
      : MOUNT_ANGLE + (Math.floor(time.getTime() / 1000) - MOUNT_SEC) * 6,
  };
}
