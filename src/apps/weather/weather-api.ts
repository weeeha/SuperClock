export interface Coords { lat: number; lon: number }

export function parseCoords(raw: string): Coords | null {
  const parts = raw.split(',');
  if (parts.length !== 2) return null;
  const lat = Number(parts[0].trim());
  const lon = Number(parts[1].trim());
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;
  if (Math.abs(lat) > 90 || Math.abs(lon) > 180) return null;
  return { lat, lon };
}

const HOURLY_FIELDS = [
  'temperature_2m', 'apparent_temperature', 'relative_humidity_2m',
  'precipitation_probability', 'wind_speed_10m', 'wind_gusts_10m',
  'uv_index', 'weather_code', 'is_day',
].join(',');

const CURRENT_FIELDS = [
  'temperature_2m', 'apparent_temperature', 'relative_humidity_2m', 'weather_code',
  'wind_speed_10m', 'wind_direction_10m', 'wind_gusts_10m',
  'uv_index', 'precipitation_probability', 'is_day',
].join(',');

const DAILY_FIELDS = 'temperature_2m_max,temperature_2m_min,sunrise,sunset';

/** One request covers all five dials plus the Now page. Open-Meteo is keyless,
 *  so this runs from the kiosk with no server proxy. */
export function buildForecastUrl(c: Coords, unit: 'celsius' | 'fahrenheit'): string {
  const params = new URLSearchParams({
    latitude: String(c.lat),
    longitude: String(c.lon),
    current: CURRENT_FIELDS,
    hourly: HOURLY_FIELDS,
    daily: DAILY_FIELDS,
    timezone: 'auto',
    forecast_days: '2',
    temperature_unit: unit,
  });
  return `https://api.open-meteo.com/v1/forecast?${params.toString()}`;
}

export function buildGeocodeUrl(name: string): string {
  const params = new URLSearchParams({ name, count: '1', language: 'en', format: 'json' });
  return `https://geocoding-api.open-meteo.com/v1/search?${params.toString()}`;
}
