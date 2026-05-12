// Browser-side cache of the device's config.
// Kiosk reads from here on boot; periodic poll keeps it fresh.
// Server is the source of truth; localStorage is the resilience layer.

import type { DeviceConfig } from './types';

const KEY = 'superclock:device-config';
const POLL_MS = 5000;

type Listener = (config: DeviceConfig | null) => void;
const listeners = new Set<Listener>();

let snapshot: DeviceConfig | null = null;
let initialized = false;

let pollTimer: number | null = null;

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

export function startConfigPolling(): void {
  if (pollTimer !== null) return;
  void fetchAndCacheConfig();
  pollTimer = window.setInterval(() => {
    void fetchAndCacheConfig();
  }, POLL_MS);
}

export function stopConfigPolling(): void {
  if (pollTimer !== null) {
    window.clearInterval(pollTimer);
    pollTimer = null;
  }
}
