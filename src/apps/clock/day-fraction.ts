// Pure local-day arithmetic for the Depletion face.
//
// Fractions are computed from the real millisecond span between local
// midnights, not a fixed 1440 minutes, so 23-hour (spring-forward) and
// 25-hour (autumn-back) days still reach empty exactly at local midnight.

import { isWithinWindow, type TimeWindow } from '../../shared/time-window';

export interface DepletionState {
  /** Fraction of the cycle remaining, 0..1. Full day at 00:00 is 1, not 0. */
  remaining: number;
  /** Angle of the "now" boundary, degrees clockwise from 12 o'clock. */
  boundaryDeg: number;
  /** Whole minutes remaining in the cycle (for the readout). */
  minutesLeft: number;
  /**
   * True when cycle='awake' and now is inside the night window — the disc
   * renders fully spent and the readout counts down to the window's end.
   */
  asleep: boolean;
}

/** Local midnight at the start of `d`'s calendar day. */
function dayStart(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

/** Local midnight at the end of `d`'s calendar day (start of tomorrow). */
function dayEnd(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1);
}

/** Parse "HH:MM" to minutes-of-day; null on malformed input. */
function parseHM(s: string): number | null {
  const m = /^(\d{1,2}):(\d{2})$/.exec(s);
  if (!m) return null;
  const h = Number(m[1]);
  const min = Number(m[2]);
  if (h > 23 || min > 59) return null;
  return h * 60 + min;
}

/** Next occurrence (>= now) of a local wall-clock "HH:MM". */
function nextOccurrence(now: Date, hm: number): Date {
  const t = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, hm);
  if (t.getTime() <= now.getTime()) t.setDate(t.getDate() + 1);
  return t;
}

/**
 * Depletion state for the calendar-day cycle: the accent wedge is the time
 * from `now` until local midnight.
 */
export function calendarDayState(now: Date): DepletionState {
  const start = dayStart(now).getTime();
  const end = dayEnd(now).getTime();
  const remaining = (end - now.getTime()) / (end - start);
  return {
    remaining,
    boundaryDeg: (1 - remaining) * 360,
    minutesLeft: Math.round((end - now.getTime()) / 60_000),
    asleep: false,
  };
}

/**
 * Depletion state for the awake cycle: the disc spans the hours outside the
 * device's night window. Inside the window the disc is fully spent and
 * `minutesLeft` counts down to the window's end (wake time).
 *
 * With no valid window this falls back to the calendar day rather than
 * failing — an unconfigured device must never show an empty face.
 */
export function awakeState(now: Date, night: TimeWindow | undefined): DepletionState {
  const startHM = night ? parseHM(night.start) : null;
  const endHM = night ? parseHM(night.end) : null;
  if (!night || startHM === null || endHM === null || startHM === endHM) {
    return calendarDayState(now);
  }

  if (isWithinWindow(night, now)) {
    const wake = nextOccurrence(now, endHM);
    return {
      remaining: 0,
      boundaryDeg: 360,
      minutesLeft: Math.round((wake.getTime() - now.getTime()) / 60_000),
      asleep: true,
    };
  }

  // Awake: the cycle runs from the wake that opened it (the most recent
  // window end at or before now) to the next window start.
  const sleep = nextOccurrence(now, startHM);
  const wake = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, endHM);
  if (wake.getTime() > now.getTime()) wake.setDate(wake.getDate() - 1);

  const total = sleep.getTime() - wake.getTime();
  const remaining = (sleep.getTime() - now.getTime()) / total;
  return {
    remaining,
    boundaryDeg: (1 - remaining) * 360,
    minutesLeft: Math.round((sleep.getTime() - now.getTime()) / 60_000),
    asleep: false,
  };
}

/** SVG path for a wedge from `fromDeg` to `toDeg` (clockwise from 12). */
export function wedgePath(
  cx: number,
  cy: number,
  r: number,
  fromDeg: number,
  toDeg: number,
): string {
  let sweep = toDeg - fromDeg;
  if (sweep <= 0) sweep += 360;
  // A full circle can't be a single arc — split it.
  if (sweep >= 359.999) {
    return [
      `M ${cx} ${cy - r}`,
      `A ${r} ${r} 0 1 1 ${cx} ${cy + r}`,
      `A ${r} ${r} 0 1 1 ${cx} ${cy - r}`,
      'Z',
    ].join(' ');
  }
  const rad = (deg: number) => ((deg - 90) * Math.PI) / 180;
  const x1 = cx + r * Math.cos(rad(fromDeg));
  const y1 = cy + r * Math.sin(rad(fromDeg));
  const x2 = cx + r * Math.cos(rad(toDeg));
  const y2 = cy + r * Math.sin(rad(toDeg));
  const large = sweep > 180 ? 1 : 0;
  return `M ${cx} ${cy} L ${x1} ${y1} A ${r} ${r} 0 ${large} 1 ${x2} ${y2} Z`;
}
