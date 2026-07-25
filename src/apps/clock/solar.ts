// Sunrise/sunset for the Daylight face — NOAA's simplified solar equations.
// Pure and network-free on purpose: a wall clock must not need wifi to draw
// its dial, and f(lat, lon, date) is testable with fixed inputs.
//
// Accuracy is within a couple of minutes at ordinary latitudes, which is far
// below what a 60-unit-wide arc on a 1000-unit dial can show.

export type SunTimes =
  | {
      kind: 'normal';
      /** Local wall-clock minutes (0..1440) in the environment's timezone. */
      sunriseMin: number;
      sunsetMin: number;
    }
  | { kind: 'polar-day' } // sun never sets — band is the full ring
  | { kind: 'polar-night' }; // sun never rises — band is empty

const RAD = Math.PI / 180;

/** Day of year, 1-based, from the local calendar date. */
function dayOfYear(d: Date): number {
  const start = Date.UTC(d.getFullYear(), 0, 0);
  const here = Date.UTC(d.getFullYear(), d.getMonth(), d.getDate());
  return (here - start) / 86_400_000;
}

/**
 * NOAA sunrise equation. Returns local wall-clock minutes for the calendar
 * day of `date`, using the JS environment's own UTC offset for that date —
 * which is the same clock the rest of the kiosk renders.
 */
export function sunTimes(date: Date, latitude: number, longitude: number): SunTimes {
  const N = dayOfYear(date);

  // Fractional year (radians), midday approximation.
  const gamma = ((2 * Math.PI) / 365) * (N - 1 + 0.5);

  // Equation of time (minutes) and solar declination (radians) — NOAA series.
  const eqTime =
    229.18 *
    (0.000075 +
      0.001868 * Math.cos(gamma) -
      0.032077 * Math.sin(gamma) -
      0.014615 * Math.cos(2 * gamma) -
      0.040849 * Math.sin(2 * gamma));
  const decl =
    0.006918 -
    0.399912 * Math.cos(gamma) +
    0.070257 * Math.sin(gamma) -
    0.006758 * Math.cos(2 * gamma) +
    0.000907 * Math.sin(2 * gamma) -
    0.002697 * Math.cos(3 * gamma) +
    0.00148 * Math.sin(3 * gamma);

  // Hour angle at official sunrise/sunset (zenith 90.833°: refraction + disc).
  const zenith = 90.833 * RAD;
  const cosHa =
    (Math.cos(zenith) - Math.sin(latitude * RAD) * Math.sin(decl)) /
    (Math.cos(latitude * RAD) * Math.cos(decl));

  if (cosHa < -1) return { kind: 'polar-day' };
  if (cosHa > 1) return { kind: 'polar-night' };

  const haMin = (Math.acos(cosHa) / RAD) * 4; // degrees → minutes of time

  // Minutes UTC.
  const solarNoonUtc = 720 - 4 * longitude - eqTime;
  const sunriseUtc = solarNoonUtc - haMin;
  const sunsetUtc = solarNoonUtc + haMin;

  // UTC → local wall clock via the environment's offset for this date
  // (DST-correct for the zone the kiosk actually renders in).
  const offsetMin = -date.getTimezoneOffset();
  const toLocal = (m: number) => ((m + offsetMin) % 1440 + 1440) % 1440;

  return {
    kind: 'normal',
    sunriseMin: toLocal(sunriseUtc),
    sunsetMin: toLocal(sunsetUtc),
  };
}
