import { useEffect, useState } from 'react';
import { buildForecastUrl, buildGeocodeUrl, parseCoords, type Coords } from './weather-api';
import { parseForecast, type WeatherModel } from './weather-utils';

const GEO_CACHE_KEY = 'superclock.weather.geo';
const REFRESH_MS = 15 * 60 * 1000;

async function resolveLocation(location: string): Promise<{ coords: Coords; label: string }> {
  const trimmed = location.trim();

  if (trimmed) {
    const direct = parseCoords(trimmed);
    if (direct) return { coords: direct, label: '' };

    const cachedRaw = localStorage.getItem(GEO_CACHE_KEY);
    if (cachedRaw) {
      try {
        const cached = JSON.parse(cachedRaw);
        if (cached.query === trimmed) return { coords: cached.coords, label: cached.label };
      } catch {
        localStorage.removeItem(GEO_CACHE_KEY);
      }
    }

    const res = await fetch(buildGeocodeUrl(trimmed));
    if (!res.ok) throw new Error(`Geocoding failed: ${res.status}`);
    const json = await res.json();
    const hit = json.results?.[0];
    if (!hit) throw new Error(`No location matched "${trimmed}"`);
    const resolved = {
      coords: { lat: hit.latitude, lon: hit.longitude },
      label: String(hit.name),
    };
    localStorage.setItem(GEO_CACHE_KEY, JSON.stringify({ query: trimmed, ...resolved }));
    return resolved;
  }

  // Legacy fallback so devices still on env vars keep working until their
  // fleet config carries a location. Removed in Task 9.
  const lat = import.meta.env.VITE_WEATHER_LAT;
  const lon = import.meta.env.VITE_WEATHER_LON;
  if (!lat || !lon) throw new Error('No weather location configured');
  return { coords: { lat: Number(lat), lon: Number(lon) }, label: '' };
}

export interface WeatherState {
  model: WeatherModel | null;
  label: string;
  offline: boolean;
}

/** Fetches once on mount, then refreshes every 15 minutes while the app is
 *  active. Background apps must not tick — a kiosk runs for weeks, and leaked
 *  timers are real heat on a Pi. */
export function useWeather(
  location: string,
  unit: 'celsius' | 'fahrenheit',
  isActive: boolean,
): WeatherState {
  const [model, setModel] = useState<WeatherModel | null>(null);
  const [label, setLabel] = useState('');
  const [offline, setOffline] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const { coords, label: resolved } = await resolveLocation(location);
        const res = await fetch(buildForecastUrl(coords, unit));
        if (!res.ok) throw new Error(`Open-Meteo error: ${res.status}`);
        const json = await res.json();
        if (cancelled) return;
        setModel(parseForecast(json, new Date()));
        setLabel(resolved);
        setOffline(false);
      } catch (err) {
        if (cancelled) return;
        console.warn('Weather fetch failed:', (err as Error).message);
        setOffline(true);
      }
    }

    load();
    if (!isActive) {
      return () => {
        cancelled = true;
      };
    }

    const id = setInterval(load, REFRESH_MS);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [location, unit, isActive]);

  return { model, label, offline };
}
