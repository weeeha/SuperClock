import { useEffect, useRef, useState } from 'react';
import type { CalendarEvent } from '../../api/types';

const CACHE_KEY = 'calendar:last-good';
const POLL_MS = 5 * 60 * 1000;

interface Cached {
  events: CalendarEvent[];
}

function loadCache(): CalendarEvent[] {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return [];
    return (JSON.parse(raw) as Cached).events ?? [];
  } catch {
    return [];
  }
}

function saveCache(events: CalendarEvent[]): void {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify({ events } satisfies Cached));
  } catch {
    // storage full/unavailable — non-fatal, we just lose the cache
  }
}

export interface CalendarData {
  events: CalendarEvent[];
  offline: boolean;
  loading: boolean;
}

/** Fetches events overlapping [from,to]. `enabled` should be the app's isActive.
 *  Refetches when the ISO range strings change; polls every 5 min while enabled. */
export function useCalendarEvents(fromIso: string, toIso: string, enabled: boolean): CalendarData {
  const [events, setEvents] = useState<CalendarEvent[]>(loadCache);
  const [offline, setOffline] = useState(false);
  const [loading, setLoading] = useState(true);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    if (!enabled) {
      setLoading(false);
      return;
    }
    let cancelled = false;

    async function load() {
      abortRef.current?.abort();
      const ac = new AbortController();
      abortRef.current = ac;
      setLoading(true);
      try {
        const res = await fetch(`/api/calendar?from=${encodeURIComponent(fromIso)}&to=${encodeURIComponent(toIso)}`, {
          signal: ac.signal,
        });
        if (!res.ok) throw new Error(`status ${res.status}`);
        const data = (await res.json()) as CalendarEvent[];
        if (cancelled) return;
        setEvents(data);
        saveCache(data);
        setOffline(false);
      } catch (err) {
        if ((err as Error).name === 'AbortError' || cancelled) return;
        setOffline(true); // keep last-good events already in state
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    const id = setInterval(load, POLL_MS);
    return () => {
      cancelled = true;
      clearInterval(id);
      abortRef.current?.abort();
    };
  }, [fromIso, toIso, enabled]);

  return { events, offline, loading };
}
