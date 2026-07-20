// Client-side radar store: one shared EventSource on /api/radar/stream,
// exposed as a hook. The stream opens on the first subscriber and closes
// when the last one unmounts; EventSource handles reconnection itself.

import { useSyncExternalStore } from 'react';
import type { RadarSnapshot } from '../shared/radar';

let snapshot: RadarSnapshot | null = null;
const listeners = new Set<() => void>();
let stream: EventSource | null = null;

function ensureStream(): void {
  if (stream || typeof window === 'undefined') return;
  stream = new EventSource('/api/radar/stream');
  stream.onmessage = (e) => {
    try {
      snapshot = JSON.parse(e.data as string) as RadarSnapshot;
    } catch {
      return;
    }
    for (const listener of listeners) listener();
  };
  // onerror intentionally unhandled — EventSource retries on its own and the
  // last snapshot stays displayed meanwhile.
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  ensureStream();
  return () => {
    listeners.delete(listener);
    if (listeners.size === 0) {
      stream?.close();
      stream = null;
    }
  };
}

const getSnapshot = (): RadarSnapshot | null => snapshot;
const getServerSnapshot = (): RadarSnapshot | null => null;

export function useRadar(): RadarSnapshot | null {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}

export async function setRadarMode(mode: 'presence' | 'breathing'): Promise<void> {
  try {
    await fetch('/api/radar/mode', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mode }),
    });
  } catch {
    // best-effort — the server lease expires on its own
  }
}
