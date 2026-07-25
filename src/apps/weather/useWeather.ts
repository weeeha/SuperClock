import { useCallback, useEffect, useState } from 'react';
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
    try {
      localStorage.setItem(GEO_CACHE_KEY, JSON.stringify({ query: trimmed, ...resolved }));
    } catch {
      // Cache write is best-effort — a full or disabled localStorage must not
      // discard a location we already resolved successfully.
    }
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

/** Fetches once on mount (and whenever location/unit change), then refreshes
 *  every 15 minutes while the app is active. Background apps must not tick —
 *  a kiosk runs for weeks, and leaked timers are real heat on a Pi. */
export function useWeather(
  location: string,
  unit: 'celsius' | 'fahrenheit',
  isActive: boolean,
): WeatherState {
  const [model, setModel] = useState<WeatherModel | null>(null);
  const [label, setLabel] = useState('');
  const [offline, setOffline] = useState(false);

  const load = useCallback(async (isCancelled: () => boolean) => {
    try {
      const { coords, label: resolved } = await resolveLocation(location);
      const res = await fetch(buildForecastUrl(coords, unit));
      if (!res.ok) throw new Error(`Open-Meteo error: ${res.status}`);
      const json = await res.json();
      if (isCancelled()) return;
      setModel(parseForecast(json, new Date()));
      setLabel(resolved);
      setOffline(false);
    } catch (err) {
      if (isCancelled()) return;
      console.warn('Weather fetch failed:', (err as Error).message);
      setOffline(true);
    }
  }, [location, unit]);

  // Initial load, and again whenever the configured location or unit changes.
  // Deliberately NOT gated on isActive: the app grid deactivates this app
  // without unmounting it, so re-running here on every toggle would fire a
  // request each time the grid opens or closes.
  useEffect(() => {
    let cancelled = false;
    load(() => cancelled);
    return () => {
      cancelled = true;
    };
  }, [load]);

  // Periodic refresh only — gated on isActive so background apps don't tick.
  useEffect(() => {
    if (!isActive) return;
    let cancelled = false;
    const id = setInterval(() => load(() => cancelled), REFRESH_MS);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [isActive, load]);

  return { model, label, offline };
}
