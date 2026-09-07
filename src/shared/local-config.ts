// Browser-side cache of the device's config.
// Kiosk reads from here on boot; a server-sent stream keeps it fresh, with a
// slow poll behind it as the fallback.
// Server is the source of truth; localStorage is the resilience layer.

import type { DeviceConfig } from './types';

const KEY = 'superclock:device-config';
// The poll is the fallback now, not the delivery mechanism: /api/device/config/stream
// pushes a change the moment it is persisted. At the old 5s this cost 17,280
// requests per device per day, every one of them reading and parsing
// fleet.json from disk, to deliver a change that is usually not there.
const POLL_MS = 60_000;

type Listener = (config: DeviceConfig | null) => void;
const listeners = new Set<Listener>();

let snapshot: DeviceConfig | null = null;
let initialized = false;

let pollTimer: number | null = null;
let source: EventSource | null = null;

function parseStored(raw: string | null): DeviceConfig | null {
  if (!raw) return null;
  try {
    return JSON.parse(raw) as DeviceConfig;
  } catch {
    return null;
  }
}

function ensureInitialized(): void {
  if (initialized) return;
  initialized = true;
  if (typeof localStorage === 'undefined') {
    snapshot = null;
    return;
  }
  snapshot = parseStored(localStorage.getItem(KEY));
  if (typeof window !== 'undefined') {
    window.addEventListener('storage', (e) => {
      if (e.key === KEY) {
        snapshot = parseStored(e.newValue);
        for (const listener of listeners) listener(snapshot);
      }
    });
  }
}

// Returns the cached snapshot. The reference is stable until saveLocalConfig
// (or a cross-tab storage event) replaces it — required so useSyncExternalStore
// doesn't loop.
export function loadLocalConfig(): DeviceConfig | null {
  ensureInitialized();
  return snapshot;
}

export function saveLocalConfig(config: DeviceConfig): void {
  ensureInitialized();
  snapshot = config;
  if (typeof localStorage !== 'undefined') {
    try {
      localStorage.setItem(KEY, JSON.stringify(config));
    } catch {
      // ignore — quota full, private mode, etc.
    }
  }
  for (const listener of listeners) listener(config);
}

export function subscribeToConfig(listener: Listener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function shallowEqualConfig(a: DeviceConfig | null, b: DeviceConfig | null): boolean {
  if (a === b) return true;
  if (!a || !b) return false;
  // Compare on updatedAt + version-like fields. If server returns the same
  // updatedAt, treat as unchanged so we don't replace the snapshot ref needlessly.
  return a.updatedAt === b.updatedAt && a.deviceId === b.deviceId;
}

export async function fetchAndCacheConfig(signal?: AbortSignal): Promise<DeviceConfig | null> {
  try {
    const res = await fetch('/api/device/config', { signal });
    if (!res.ok) return null;
    const config = (await res.json()) as DeviceConfig;
    ensureInitialized();
    if (!shallowEqualConfig(snapshot, config)) {
      saveLocalConfig(config);
    }
    return config;
  } catch {
    return null;
  }
}

export function startConfigSync(): void {
  if (pollTimer !== null) return;
  void fetchAndCacheConfig();
  pollTimer = window.setInterval(() => {
    void fetchAndCacheConfig();
  }, POLL_MS);

  // EventSource reconnects on its own after a drop, so the only job here is
  // to open it. A browser without EventSource keeps working on the poll alone.
  if (typeof EventSource === 'undefined') return;
  source = new EventSource('/api/device/config/stream');
  source.onmessage = (event) => {
    let config: DeviceConfig;
    try {
      config = JSON.parse(event.data) as DeviceConfig;
    } catch {
      // A truncated frame is not a reason to drop a good cached config.
      return;
    }
    ensureInitialized();
    if (!shallowEqualConfig(snapshot, config)) saveLocalConfig(config);
  };
}

export function stopConfigSync(): void {
  if (source !== null) {
    source.close();
    source = null;
  }
  if (pollTimer !== null) {
    window.clearInterval(pollTimer);
    pollTimer = null;
  }
}
