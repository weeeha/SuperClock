import { useState, useEffect, useMemo } from 'react';
import type { AppProps } from '../../core/types';
import { resolveWeatherQuery, type Coords, type WeatherQuery } from './weather-config';

interface ForecastDay {
  day: string;
  icon: string;
  high: number;
  low: number;
}

interface WeatherData {
  current: number;
  high: number;
  low: number;
  icon: string;
  forecast: ForecastDay[];
}

const FALLBACK: WeatherData = {
  current: 30,
  high: 31,
  low: 26,
  icon: '☀️',
  forecast: [
    { day: 'MO', icon: '☀️', high: 31, low: 26 },
    { day: 'TU', icon: '⛅', high: 29, low: 20 },
    { day: 'WE', icon: '🌧️', high: 31, low: 22 },
  ],
};

const DAY_NAMES = ['SU', 'MO', 'TU', 'WE', 'TH', 'FR', 'SA'];

function codeToIcon(code: number): string {
  if (code === 0) return '☀️';
  if (code <= 3) return '⛅';
  if (code === 45 || code === 48) return '🌫️';
  if (code >= 51 && code <= 67) return '🌧️';
  if (code >= 71 && code <= 77) return '❄️';
  if (code >= 80 && code <= 82) return '🌧️';
  if (code === 85 || code === 86) return '🌨️';
  if (code >= 95) return '⛈️';
  return '⛅';
}

// A place name resolves to the same point forever, so geocode once per boot.
// Not worth persisting: a cache hit is useless without a network for the
// forecast call itself.
const geocodeCache = new Map<string, Coords>();

async function geocode(place: string): Promise<Coords> {
  const cached = geocodeCache.get(place.toLowerCase());
  if (cached) return cached;

  const params = new URLSearchParams({ name: place, count: '1', format: 'json' });
  const res = await fetch(`https://geocoding-api.open-meteo.com/v1/search?${params.toString()}`);
  if (!res.ok) throw new Error(`Open-Meteo geocoding error: ${res.status}`);
  const json = await res.json();
  const hit = json?.results?.[0];
  if (typeof hit?.latitude !== 'number' || typeof hit?.longitude !== 'number') {
    throw new Error(`No place matches "${place}"`);
  }

  const coords: Coords = { latitude: hit.latitude, longitude: hit.longitude };
  geocodeCache.set(place.toLowerCase(), coords);
  return coords;
}

async function fetchWeather(query: WeatherQuery): Promise<WeatherData> {
  const coords = query.coords ?? (query.place ? await geocode(query.place) : null);
  if (!coords) throw new Error('No weather location configured');

  const params = new URLSearchParams({
    latitude: String(coords.latitude),
    longitude: String(coords.longitude),
    current: 'temperature_2m,weather_code',
    daily: 'temperature_2m_max,temperature_2m_min,weather_code',
    timezone: query.timezone,
    forecast_days: String(query.forecastDays),
    temperature_unit: query.unit,
  });
  const url = `https://api.open-meteo.com/v1/forecast?${params.toString()}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Open-Meteo error: ${res.status}`);
  const json = await res.json();

  const current = Math.round(json.current.temperature_2m);
  const today = {
    high: Math.round(json.daily.temperature_2m_max[0]),
    low: Math.round(json.daily.temperature_2m_min[0]),
    icon: codeToIcon(json.current.weather_code),
  };

  // Day 0 is today, already shown as the big current reading — the strip gets
  // whatever `forecast_days` returned beyond it.
  const forecast: ForecastDay[] = [];
  for (let i = 1; i < json.daily.time.length; i++) {
    // Parse "YYYY-MM-DD" as LOCAL midnight — new Date(string) parses it as
    // UTC and getDay() then reads local, shifting weekday labels by one in
    // UTC-negative timezones.
    const [y, mo, d] = String(json.daily.time[i]).split('-').map(Number);
    const date = new Date(y, mo - 1, d);
    forecast.push({
      day: DAY_NAMES[date.getDay()],
      icon: codeToIcon(json.daily.weather_code[i]),
      high: Math.round(json.daily.temperature_2m_max[i]),
      low: Math.round(json.daily.temperature_2m_min[i]),
    });
  }

  return { current, high: today.high, low: today.low, icon: today.icon, forecast };
}

/** Weather screen — based on Figma S2 design (489:20881). Live data via Open-Meteo. */
export default function WeatherApp({ isActive, config }: AppProps) {
  // The pushed device config wins; the VITE_ vars are only a fallback, since
  // they're baked into the bundle and can't be changed without a redeploy.
  // `config`'s identity is stable between polls (see local-config.ts), so this
  // re-runs — and refetches below — only when the fleet config actually moves.
  const query = useMemo(
    () =>
      resolveWeatherQuery(config, {
        lat: import.meta.env.VITE_WEATHER_LAT,
        lon: import.meta.env.VITE_WEATHER_LON,
        tz: import.meta.env.VITE_WEATHER_TZ,
        unit: import.meta.env.VITE_WEATHER_UNIT,
      }),
    [config],
  );

  const [time, setTime] = useState(new Date());
  // null = no live data yet; the FALLBACK visuals render with an explicit
  // "offline" tell instead of masquerading as a real reading for days.
  const [weather, setWeather] = useState<WeatherData | null>(null);
  const [offline, setOffline] = useState(false);

  useEffect(() => {
    if (!isActive) return;
    // Only the HH:MM display consumes `time` — returning the previous state
    // when the minute hasn't changed skips the re-render, so this ticks the
    // whole tree once a minute instead of once a second (real heat on a Pi).
    const id = setInterval(() => {
      setTime((prev) => {
        const now = new Date();
        return now.getMinutes() === prev.getMinutes() && now.getHours() === prev.getHours()
          ? prev
          : now;
      });
    }, 1000);
    return () => clearInterval(id);
  }, [isActive]);

  useEffect(() => {
    let cancelled = false;
    fetchWeather(query)
      .then((data) => {
        if (cancelled) return;
        setWeather(data);
        setOffline(false);
      })
      .catch((err) => {
        if (cancelled) return;
        console.warn('Weather fetch failed:', err.message);
        setOffline(true);
      });
    return () => {
      cancelled = true;
    };
  }, [query]);

  useEffect(() => {
    if (!isActive) return;
    let cancelled = false;
    const id = setInterval(() => {
      fetchWeather(query)
        .then((data) => {
          if (cancelled) return;
          setWeather(data);
          setOffline(false);
        })
        .catch(() => {
          if (cancelled) return;
          setOffline(true);
        });
    }, 15 * 60 * 1000);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [isActive, query]);

  const shown = weather ?? FALLBACK;

  const timeStr = time.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false });
  const dayStr = time.toLocaleDateString('en-US', { weekday: 'short' }).toUpperCase();
  const dateStr = `${String(time.getDate()).padStart(2, '0')}-${String(time.getMonth() + 1).padStart(2, '0')}`;

  return (
    <div className="relative flex h-full w-full flex-col items-center bg-black px-[12%] py-[6%]">
      <p className="text-[9.6vmin] font-semibold text-white leading-none">{timeStr}</p>

      <div className="flex items-baseline gap-2 mt-1">
        <span className="text-[6.4vmin] font-semibold text-[#ff8826]">{dayStr}</span>
        <span className="text-[6.4vmin] font-semibold text-white">{dateStr}</span>
      </div>
      {offline && (
        <span className="mt-1 font-mono text-[2.4vmin] text-white/30">offline</span>
      )}

      <div className="flex items-center mt-[4%] w-full">
        <div className="flex-shrink-0 text-[28vmin] leading-none">
          {shown.icon}
        </div>
        <div className="flex flex-col items-start ml-auto">
          <p className="text-[18vmin] font-semibold text-white leading-none">{shown.current}°</p>
          <div className="flex items-baseline gap-3">
            <span className="text-[9.6vmin] font-semibold text-[#eee9bf]">{shown.high}°</span>
            <span className="text-[9.6vmin] font-semibold text-[#609cc4]">{shown.low}°</span>
          </div>
        </div>
      </div>

      <div className="flex w-full justify-around mt-auto">
        {shown.forecast.map((f) => (
          <div key={f.day} className="flex flex-col items-center gap-1">
            <span className="text-[6.4vmin] font-semibold text-[#6d6d6d]">{f.day}</span>
            <span className="text-[9.6vmin]">{f.icon}</span>
            <div className="flex gap-1">
              <span className="text-[4.8vmin] font-semibold text-white">{f.high}°</span>
              <span className="text-[4.8vmin] font-semibold text-[#eee9bf]">{f.low}°</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
