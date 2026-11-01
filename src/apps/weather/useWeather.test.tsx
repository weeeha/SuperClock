// @vitest-environment jsdom
// Every visit to Weather remounts the app, and the Fields skin drew an empty
// disc for the second the refetch took (2026-11-01 review). The last good
// model is kept per query, in memory and in localStorage, so a remount shows
// it at once and the fetch only refreshes it.
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { useWeather, weatherCacheKey } from './useWeather';
import { resolveWeatherQuery } from './weather-config';
import type { WeatherModel } from './weather-utils';

const ENV = { lat: undefined, lon: undefined, tz: undefined, unit: undefined };
const CONFIG = { location: 'Montreal', unit: 'celsius' };

/** Trimmed but structurally exact Open-Meteo payload, as in weather-utils.test. */
function forecastFixture() {
  const time: string[] = [];
  for (let hh = 0; hh < 24; hh++) time.push(`2026-07-24T${String(hh).padStart(2, '0')}:00`);
  for (let hh = 0; hh < 12; hh++) time.push(`2026-07-25T${String(hh).padStart(2, '0')}:00`);
  const n = time.length;
  const seq = (f: (i: number) => number) => Array.from({ length: n }, (_, i) => f(i));
  return {
    utc_offset_seconds: -14400,
    current: {
      time: '2026-07-24T17:00', temperature_2m: 27.4, apparent_temperature: 28.1,
      relative_humidity_2m: 51, weather_code: 1, wind_speed_10m: 11.2, wind_direction_10m: 234,
      wind_gusts_10m: 21.3, uv_index: 2.4, precipitation_probability: 0, is_day: 1,
    },
    hourly: {
      time,
      temperature_2m: seq((i) => 20 + (i % 12)),
      apparent_temperature: seq((i) => 21 + (i % 12)),
      relative_humidity_2m: seq(() => 50),
      precipitation_probability: seq((i) => i % 30),
      wind_speed_10m: seq(() => 11),
      wind_gusts_10m: seq(() => 21),
      uv_index: seq((i) => (i % 12) / 4),
      weather_code: seq(() => 1),
      is_day: seq((i) => (i % 24 >= 6 && i % 24 < 20 ? 1 : 0)),
    },
    daily: {
      time: ['2026-07-24', '2026-07-25'],
      temperature_2m_max: [27, 29],
      temperature_2m_min: [15, 17],
      sunrise: ['2026-07-24T05:29', '2026-07-25T05:30'],
      sunset: ['2026-07-24T20:32', '2026-07-25T20:31'],
    },
  };
}

const SEEDED: WeatherModel = {
  current: { hour: 13, temp: 9, apparent: 7, humidity: 60, code: 3, windSpeed: 10, windDir: 200, windGust: 20, uv: 1, precipProb: 0, isDay: true },
  today: { high: 11, low: -1, sunriseMin: 393, sunsetMin: 1001 },
  hours: [],
};

function jsonResponse(body: unknown): Response {
  return { ok: true, status: 200, json: async () => body } as unknown as Response;
}

beforeEach(() => {
  localStorage.clear();
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe('useWeather cache', () => {
  it('shows the stored model at once while the fetch is still in flight', () => {
    const key = weatherCacheKey(resolveWeatherQuery(CONFIG, ENV));
    localStorage.setItem(key, JSON.stringify({ model: SEEDED, label: 'Montréal', updatedAt: '2026-11-01T13:40:00.000Z' }));
    vi.stubGlobal('fetch', () => new Promise<Response>(() => {}));

    const { result } = renderHook(() => useWeather(CONFIG, true));

    expect(result.current.model).toEqual(SEEDED);
    expect(result.current.label).toBe('Montréal');
    expect(result.current.updatedAt?.toISOString()).toBe('2026-11-01T13:40:00.000Z');
    expect(result.current.offline).toBe(false);
  });

  it('writes the model it fetched so the next mount can start from it', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    vi.setSystemTime(new Date(2026, 6, 24, 17, 25, 0));
    const fetchMock = vi.fn(async (url: string) =>
      url.includes('geocoding')
        ? jsonResponse({ results: [{ latitude: 45.5, longitude: -73.6, name: 'Montréal' }] })
        : jsonResponse(forecastFixture()),
    );
    vi.stubGlobal('fetch', fetchMock);

    const { result } = renderHook(() => useWeather(CONFIG, true));
    await waitFor(() => expect(result.current.model).not.toBeNull());

    const key = weatherCacheKey(resolveWeatherQuery(CONFIG, ENV));
    const stored = JSON.parse(localStorage.getItem(key) ?? 'null');
    expect(stored?.model?.current?.temp).toBe(27);
    expect(stored?.label).toBe('Montréal');
    expect(typeof stored?.updatedAt).toBe('string');
  });
});
