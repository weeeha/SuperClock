import { describe, it, expect } from 'vitest';
import { parseCoords, resolveWeatherQuery, type WeatherEnv } from './weather-config';

const NO_ENV: WeatherEnv = {};
const ENV: WeatherEnv = { lat: '52.52', lon: '13.405', tz: 'Europe/Berlin', unit: 'fahrenheit' };

describe('parseCoords', () => {
  it('parses a plain pair', () => {
    expect(parseCoords('37.78,-122.42')).toEqual({ latitude: 37.78, longitude: -122.42 });
  });
  it('tolerates surrounding and inner whitespace', () => {
    expect(parseCoords('  37.78 , -122.42 ')).toEqual({ latitude: 37.78, longitude: -122.42 });
  });
  it('parses integers', () => {
    expect(parseCoords('52,13')).toEqual({ latitude: 52, longitude: 13 });
  });
  it('rejects place names', () => {
    expect(parseCoords('San Francisco')).toBeNull();
    expect(parseCoords('Paris, France')).toBeNull();
  });
  it('rejects out-of-range values', () => {
    expect(parseCoords('91,0')).toBeNull();
    expect(parseCoords('0,181')).toBeNull();
  });
  it('rejects malformed pairs', () => {
    expect(parseCoords('')).toBeNull();
    expect(parseCoords('37.78')).toBeNull();
    expect(parseCoords('37.78,-122.42,5')).toBeNull();
  });
});

describe('resolveWeatherQuery — location', () => {
  it('uses coordinates from config', () => {
    const q = resolveWeatherQuery({ location: '37.78,-122.42' }, ENV);
    expect(q.coords).toEqual({ latitude: 37.78, longitude: -122.42 });
    expect(q.place).toBe('');
  });

  it('config coordinates beat the env vars', () => {
    expect(resolveWeatherQuery({ location: '37.78,-122.42' }, ENV).coords).toEqual({
      latitude: 37.78,
      longitude: -122.42,
    });
  });

  it('passes a city name through for geocoding', () => {
    const q = resolveWeatherQuery({ location: 'San Francisco' }, ENV);
    expect(q.coords).toBeNull();
    expect(q.place).toBe('San Francisco');
  });

  it('falls back to env coordinates when location is blank', () => {
    expect(resolveWeatherQuery({ location: '   ' }, ENV).coords).toEqual({
      latitude: 52.52,
      longitude: 13.405,
    });
  });

  it('falls back to env coordinates when there is no config at all', () => {
    expect(resolveWeatherQuery(undefined, ENV).coords).toEqual({
      latitude: 52.52,
      longitude: 13.405,
    });
  });

  it('reports nothing configured when both config and env are empty', () => {
    const q = resolveWeatherQuery({}, NO_ENV);
    expect(q.coords).toBeNull();
    expect(q.place).toBe('');
  });

  it('ignores unusable env coordinates rather than fetching 0,0', () => {
    expect(resolveWeatherQuery({}, { lat: 'nope', lon: '13.405' }).coords).toBeNull();
  });
});

describe('resolveWeatherQuery — unit', () => {
  it('takes the configured unit', () => {
    expect(resolveWeatherQuery({ unit: 'celsius' }, ENV).unit).toBe('celsius');
    expect(resolveWeatherQuery({ unit: 'fahrenheit' }, { unit: 'celsius' }).unit).toBe('fahrenheit');
  });

  it('falls back to the env var when unit is unset', () => {
    expect(resolveWeatherQuery({ location: 'Berlin' }, ENV).unit).toBe('fahrenheit');
  });

  it('defaults to celsius when neither is set', () => {
    expect(resolveWeatherQuery({}, NO_ENV).unit).toBe('celsius');
  });

  it('treats a junk env value as celsius', () => {
    expect(resolveWeatherQuery({}, { unit: 'kelvin' }).unit).toBe('celsius');
  });
});

describe('resolveWeatherQuery — timezone', () => {
  it('takes the env timezone, defaulting to auto', () => {
    expect(resolveWeatherQuery({}, ENV).timezone).toBe('Europe/Berlin');
    expect(resolveWeatherQuery({}, NO_ENV).timezone).toBe('auto');
    expect(resolveWeatherQuery({}, { tz: '  ' }).timezone).toBe('auto');
  });
});

describe('resolveWeatherQuery — malformed config', () => {
  it('falls back to schema defaults instead of throwing', () => {
    const q = resolveWeatherQuery({ pages: ['moon'], unit: 'kelvin' }, NO_ENV);
    expect(q.unit).toBe('celsius');
    expect(q.coords).toBeNull();
  });
});
