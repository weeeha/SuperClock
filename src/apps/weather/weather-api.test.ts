import { describe, it, expect } from 'vitest';
import { buildForecastUrl, buildGeocodeUrl } from './weather-api';

// Coordinate parsing is covered by weather-config.test.ts — this file owns the
// URL shape only.
const MONTREAL = { latitude: 45.5, longitude: -73.58 };

describe('buildForecastUrl', () => {
  it('requests every field the dials need in one call', () => {
    const url = buildForecastUrl(MONTREAL, 'celsius');
    expect(url).toContain('latitude=45.5');
    expect(url).toContain('longitude=-73.58');
    expect(url).toContain('temperature_unit=celsius');
    for (const field of [
      'temperature_2m', 'apparent_temperature', 'relative_humidity_2m',
      'precipitation_probability', 'wind_speed_10m', 'wind_gusts_10m',
      'uv_index', 'weather_code', 'is_day', 'wind_direction_10m',
    ]) {
      expect(url).toContain(field);
    }
    expect(url).toContain('sunrise');
    expect(url).toContain('sunset');
  });

  it('always asks for two days, so a 12-hour ring can cross midnight', () => {
    expect(buildForecastUrl(MONTREAL, 'celsius')).toContain('forecast_days=2');
  });

  it('honours the fahrenheit unit', () => {
    expect(buildForecastUrl(MONTREAL, 'fahrenheit')).toContain('temperature_unit=fahrenheit');
  });

  it('defaults the timezone to auto but accepts an explicit one', () => {
    expect(buildForecastUrl(MONTREAL, 'celsius')).toContain('timezone=auto');
    expect(buildForecastUrl(MONTREAL, 'celsius', 'Europe/Berlin')).toContain(
      'timezone=Europe%2FBerlin',
    );
  });
});

describe('buildGeocodeUrl', () => {
  it('asks the geocoder for a single English result', () => {
    const url = buildGeocodeUrl('Montreal');
    expect(url).toContain('geocoding-api.open-meteo.com');
    expect(url).toContain('name=Montreal');
    expect(url).toContain('count=1');
  });

  it('encodes accented place names', () => {
    expect(buildGeocodeUrl('Saint-Jérôme')).toContain('Saint-J%C3%A9r%C3%B4me');
  });
});
