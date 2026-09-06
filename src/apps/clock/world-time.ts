// Pure timezone helpers for WorldClock. No React, no timers: hand angles come
// from useClockHands' formulas, applied to another zone's wall-clock time.
//
// One formatter per timezone, built once — Intl.DateTimeFormat construction
// costs milliseconds on a Pi and the mini dials used to rebuild it 5× a second.
const formatters = new Map<string, Intl.DateTimeFormat>();

function formatterFor(tz: string): Intl.DateTimeFormat {
  let fmt = formatters.get(tz);
  if (!fmt) {
    fmt = new Intl.DateTimeFormat('en-US', {
      timeZone: tz,
      hour: 'numeric',
      minute: 'numeric',
      second: 'numeric',
      hour12: false,
    });
    formatters.set(tz, fmt);
  }
  return fmt;
}

/** The IANA zone the primary dial should follow, or null for the device
 *  clock: 'local', blank, or a name Intl rejects. An admin typo must degrade
 *  to local time, never throw at render. */
export function resolveTimezone(tz: string): string | null {
  const name = tz.trim();
  if (!name || name === 'local') return null;
  try {
    formatterFor(name);
    return name;
  } catch {
    return null;
  }
}

/** Wall-clock hour (0–11) and minute in `tz`. */
export function timeInTimezone(date: Date, tz: string): { h: number; m: number } {
  const parts = formatterFor(tz).formatToParts(date);
  const get = (t: string) => parseInt(parts.find((p) => p.type === t)?.value ?? '0', 10);
  return { h: get('hour') % 12, m: get('minute') };
}

/** Hour and minute hand angles for `tz`, same formulas as useClockHands: the
 *  hour hand advances with the minutes, the minute hand with the seconds.
 *  Seconds are identical in every zone, so they come straight from `date`. */
export function handDegreesInTimezone(
  date: Date,
  tz: string,
): { hourDeg: number; minuteDeg: number } {
  const { h, m } = timeInTimezone(date, tz);
  const seconds = date.getSeconds() + date.getMilliseconds() / 1000;
  return { hourDeg: h * 30 + m * 0.5, minuteDeg: m * 6 + seconds * 0.1 };
}
