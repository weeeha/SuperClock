import { weatherAppSchema } from '../../shared/schemas/app.weather';

/** The `VITE_WEATHER_*` build-time vars, as a plain object so this stays testable. */
export interface WeatherEnv {
  lat?: string;
  lon?: string;
  tz?: string;
  unit?: string;
}

export interface Coords {
  latitude: number;
  longitude: number;
}

export interface WeatherQuery {
  /** Coordinates when known without a network call — from `lat,lon` config or env. */
  coords: Coords | null;
  /** Place name still needing geocoding. Empty when `coords` is set or nothing is configured. */
  place: string;
  /** IANA tz name, or `auto` to let Open-Meteo infer it from the coordinates. */
  timezone: string;
  unit: 'celsius' | 'fahrenheit';
}

// Deliberately strict: two finite decimals separated by a comma. Anything else
// is treated as a place name, so a typo geocodes (and visibly fails) rather
// than silently resolving to 0,0 off the coast of Africa.
const COORD_RE = /^(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)$/;

/** Parse a `"lat,lon"` string. Returns null when it isn't a valid coordinate pair. */
export function parseCoords(location: string): Coords | null {
  const match = COORD_RE.exec(location.trim());
  if (!match) return null;
  const latitude = Number(match[1]);
  const longitude = Number(match[2]);
  if (Math.abs(latitude) > 90 || Math.abs(longitude) > 180) return null;
  return { latitude, longitude };
}

/**
 * Fold the pushed device config together with the build-time env vars.
 *
 * Config wins wherever the operator actually set something; the env vars are
 * the fallback for devices whose fleet entry leaves the field blank. Note this
 * reads `raw` (not just the zod output) for `unit` — the schema's `.default()`
 * makes an unset unit indistinguishable from an explicit "celsius", which
 * would strand `VITE_WEATHER_UNIT` permanently.
 */
export function resolveWeatherQuery(
  raw: Record<string, unknown> | undefined,
  env: WeatherEnv,
): WeatherQuery {
  const parsed = weatherAppSchema.safeParse(raw ?? {});
  const cfg = parsed.success ? parsed.data : weatherAppSchema.parse({});

  const location = cfg.location.trim();
  let coords: Coords | null = null;
  let place = '';
  if (location) {
    coords = parseCoords(location);
    if (!coords) place = location;
  } else if (env.lat && env.lon) {
    coords = parseCoords(`${env.lat},${env.lon}`);
  }

  const rawUnit = raw?.unit;
  const unit =
    rawUnit === 'celsius' || rawUnit === 'fahrenheit'
      ? rawUnit
      : env.unit === 'fahrenheit'
        ? 'fahrenheit'
        : 'celsius';

  return {
    coords,
    place,
    timezone: env.tz?.trim() || 'auto',
    unit,
  };
}
