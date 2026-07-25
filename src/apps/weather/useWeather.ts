import { useCallback, useEffect, useMemo, useState } from 'react';
import { buildForecastUrl, buildGeocodeUrl } from './weather-api';
import { resolveWeatherQuery, type Coords, type WeatherQuery } from './weather-config';
import { parseForecast, type WeatherModel } from './weather-utils';

const REFRESH_MS = 15 * 60 * 1000;

/** In-memory only, per PR #36: a persisted geocode would only help when the
 *  network is down, and the forecast call needs the network anyway. */
const geoCache = new Map<string, { coords: Coords; label: string }>();

async function geocode(place: string): Promise<{ coords: Coords; label: string }> {
  const cached = geoCache.get(place);
  if (cached) return cached;

  const res = await fetch(buildGeocodeUrl(place));
  if (!res.ok) throw new Error(`Geocoding failed: ${res.status}`);
  const json = await res.json();
  const hit = json.results?.[0];
  if (!hit) throw new Error(`No location matched "${place}"`);

  const resolved = {
    coords: { latitude: hit.latitude, longitude: hit.longitude },
    label: String(hit.name),
  };
  geoCache.set(place, resolved);
  return resolved;
}

export interface WeatherState {
  model: WeatherModel | null;
  label: string;
  offline: boolean;
}

/** Fetches once on mount (and whenever the resolved query changes), then
 *  refreshes every 15 minutes while the app is active. Background apps must not
 *  tick — a kiosk runs for weeks, and leaked timers are real heat on a Pi. */
export function useWeather(
  config: Record<string, unknown> | undefined,
  isActive: boolean,
): WeatherState {
  const [model, setModel] = useState<WeatherModel | null>(null);
  const [label, setLabel] = useState('');
  const [offline, setOffline] = useState(false);

  // The pushed device config wins; the VITE_ vars are only a fallback.
  // `config`'s identity is stable between polls (see local-config.ts), so this
  // re-runs — and refetches below — only when the fleet config actually moves.
  const query: WeatherQuery = useMemo(
    () =>
      resolveWeatherQuery(config, {
        lat: import.meta.env.VITE_WEATHER_LAT,
        lon: import.meta.env.VITE_WEATHER_LON,
        tz: import.meta.env.VITE_WEATHER_TZ,
        unit: import.meta.env.VITE_WEATHER_UNIT,
      }),
    [config],
  );

  const load = useCallback(
    async (isCancelled: () => boolean) => {
      try {
        let coords = query.coords;
        let resolvedLabel = '';

        if (!coords) {
          if (!query.place) throw new Error('No weather location configured');
          const hit = await geocode(query.place);
          coords = hit.coords;
          resolvedLabel = hit.label;
        }

        const res = await fetch(buildForecastUrl(coords, query.unit, query.timezone));
        if (!res.ok) throw new Error(`Open-Meteo error: ${res.status}`);
        const json = await res.json();
        if (isCancelled()) return;
        setModel(parseForecast(json, new Date()));
        setLabel(resolvedLabel);
        setOffline(false);
      } catch (err) {
        if (isCancelled()) return;
        console.warn('Weather fetch failed:', (err as Error).message);
        setOffline(true);
      }
    },
    [query],
  );

  // Initial load, and again whenever the resolved query changes. Deliberately
  // NOT gated on isActive: the app grid deactivates this app without unmounting
  // it, so re-running here would fire a request every time the grid opens.
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
