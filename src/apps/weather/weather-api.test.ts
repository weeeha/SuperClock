import { describe, it, expect } from 'vitest';
import { parseCoords, buildForecastUrl } from './weather-api';

describe('parseCoords', () => {
  it('reads a "lat,lon" pair', () => {
    expect(parseCoords('45.5,-73.58')).toEqual({ lat: 45.5, lon: -73.58 });
  });

  it('tolerates surrounding whitespace', () => {
    expect(parseCoords(' 45.5 , -73.58 ')).toEqual({ lat: 45.5, lon: -73.58 });
  });

  it('returns null for a city name', () => {
    expect(parseCoords('Montreal')).toBeNull();
  });

  it('returns null for out-of-range values', () => {
    expect(parseCoords('91,0')).toBeNull();
    expect(parseCoords('0,181')).toBeNull();
  });

  it('returns null for empty input', () => {
    expect(parseCoords('')).toBeNull();
  });
});

describe('buildForecastUrl', () => {
  it('requests every field the dials need in one call', () => {
    const url = buildForecastUrl({ lat: 45.5, lon: -73.58 }, 'celsius');
    expect(url).toContain('latitude=45.5');
    expect(url).toContain('longitude=-73.58');
    expect(url).toContain('temperature_unit=celsius');
    for (const field of [
      'temperature_2m', 'apparent_temperature', 'relative_humidity_2m',
      'precipitation_probability', 'wind_speed_10m', 'wind_gusts_10m',
      'uv_index', 'weather_code', 'is_day',
    ]) {
      expect(url).toContain(field);
    }
    expect(url).toContain('sunrise');
    expect(url).toContain('sunset');
    expect(url).toContain('forecast_days=2');
  });

  it('honours the fahrenheit unit', () => {
    expect(buildForecastUrl({ lat: 0, lon: 0 }, 'fahrenheit')).toContain('temperature_unit=fahrenheit');
  });
});
