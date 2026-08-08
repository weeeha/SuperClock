import type { Coords } from './weather-config';

// Coordinate parsing lives in weather-config.ts (PR #36): its regex is stricter
// than a comma split, so a typo like "Paris, France" geocodes and visibly fails
// rather than resolving near 0,0 and rendering plausible-looking weather.

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

/** Two days, always. The dials show a rolling 12-hour window, so any window
 *  starting after noon runs past midnight into the next forecast day. This is
 *  a property of the ring, not an operator preference — which is why the old
 *  `forecastDays` config field no longer exists. */
const FORECAST_DAYS = '2';

/** One request covers all five dials plus the Now page. Open-Meteo is keyless,
 *  so this runs from the kiosk with no server proxy. */
export function buildForecastUrl(
  c: Coords,
  unit: 'celsius' | 'fahrenheit',
  timezone = 'auto',
): string {
  const params = new URLSearchParams({
    latitude: String(c.latitude),
    longitude: String(c.longitude),
    current: CURRENT_FIELDS,
    hourly: HOURLY_FIELDS,
    daily: DAILY_FIELDS,
    timezone,
    forecast_days: FORECAST_DAYS,
    temperature_unit: unit,
  });
  return `https://api.open-meteo.com/v1/forecast?${params.toString()}`;
}

export function buildGeocodeUrl(name: string): string {
  const params = new URLSearchParams({ name, count: '1', language: 'en', format: 'json' });
  return `https://geocoding-api.open-meteo.com/v1/search?${params.toString()}`;
}
