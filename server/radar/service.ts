// Radar service singleton: owns the driver, folds its events into a
// RadarSnapshot, and fans updates out to SSE subscribers and the
// display-adapter. Initialized once from buildApiApp (dev + prod).

import {
  emptyRadarSnapshot,
  type RadarMode,
  type RadarSnapshot,
} from '../../src/shared/radar';
import { MockRadarDriver, SerialRadarDriver, type RadarDriver } from './driver';
import type { RadarEvent } from './protocol';

const LOG_PREFIX = '[radar]';
// Data older than this means the sensor went quiet — report unavailable.
const STALE_MS = 15_000;
// Breathing mode reverts to presence this long after the last client lease.
const BREATHING_LEASE_MS = 90_000;
const TICK_MS = 5_000;

const snapshot: RadarSnapshot = emptyRadarSnapshot();

type Listener = (s: RadarSnapshot) => void;
const listeners = new Set<Listener>();
const presenceListeners = new Set<(present: boolean) => void>();

let driver: RadarDriver | null = null;
let connected = false;
let lastEventMs = 0;
let breathingLeaseUntil = 0;
let tickTimer: ReturnType<typeof setInterval> | null = null;
const serviceStartMs = Date.now();

function notify(): void {
  snapshot.updatedAt = new Date().toISOString();
  for (const listener of listeners) listener(snapshot);
}

function setAvailable(value: boolean): void {
  if (snapshot.available === value) return;
  snapshot.available = value;
  if (!value) {
    snapshot.present = null;
    snapshot.distanceMm = null;
    snapshot.breathing = null;
  }
  notify();
}

function onDriverEvent(event: RadarEvent): void {
  lastEventMs = Date.now();
  let changed = !snapshot.available;
  snapshot.available = true;

  if (event.present !== undefined && event.present !== snapshot.present) {
    snapshot.present = event.present;
    changed = true;
    if (event.present) snapshot.lastPresentAt = new Date().toISOString();
    for (const listener of presenceListeners) listener(event.present);
  } else if (event.present) {
    // Presence re-affirmed without a flip — keep the timestamp fresh.
    snapshot.lastPresentAt = new Date().toISOString();
  }

  if (event.distanceMm !== undefined) {
    const prev = snapshot.distanceMm;
    if (prev === null || Math.abs(prev - event.distanceMm) >= 10) changed = true;
    snapshot.distanceMm = event.distanceMm;
  }

  if (event.breathingRpm !== undefined) {
    const prev = snapshot.breathing?.rpm;
    if (prev === undefined || Math.abs(prev - event.breathingRpm) >= 0.1) changed = true;
    snapshot.breathing = {
      rpm: event.breathingRpm,
      ...(event.breathingConfidence !== undefined
        ? { confidence: event.breathingConfidence }
        : {}),
    };
  }

  if (changed) notify();
}

function onDriverStatus(up: boolean): void {
  connected = up;
  if (!up) setAvailable(false);
  // When up, availability flips on the first parsed event — a connected port
  // with no intelligible data should still read as unavailable.
}

function setMode(mode: RadarMode): void {
  if (snapshot.mode === mode) return;
  snapshot.mode = mode;
  if (mode === 'presence') snapshot.breathing = null;
  driver?.setMode(mode);
  console.log(`${LOG_PREFIX} mode → ${mode}`);
  notify();
}

function tick(): void {
  if (connected && snapshot.available && Date.now() - lastEventMs > STALE_MS) {
    console.warn(`${LOG_PREFIX} no data for ${STALE_MS / 1000}s — marking unavailable`);
    setAvailable(false);
  }
  if (snapshot.mode === 'breathing' && Date.now() > breathingLeaseUntil) {
    setMode('presence');
  }
}

function shouldUseMockDriver(): boolean {
  if (process.env.RADAR_MOCK === '1') return true;
  if (process.env.RADAR_MOCK === '0') return false;
  // Dev servers (vite sets NODE_ENV=development) get the mock by default so
  // /api/radar and its consumers are demoable without hardware.
  return process.env.NODE_ENV === 'development';
}

export function initRadarService(): void {
  if (driver || process.env.RADAR_DISABLED === '1') return;
  driver = shouldUseMockDriver() ? new MockRadarDriver() : new SerialRadarDriver();
  snapshot.source = driver.source;
  driver.start(onDriverEvent, onDriverStatus);
  tickTimer = setInterval(tick, TICK_MS);
  tickTimer.unref?.();
}

export function stopRadarService(): void {
  driver?.stop();
  driver = null;
  if (tickTimer) clearInterval(tickTimer);
  tickTimer = null;
}

export function getRadarSnapshot(): RadarSnapshot {
  return snapshot;
}

export function subscribeRadar(listener: Listener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

// Fires on every presence flip — lets the display-adapter react immediately
// instead of waiting for its 30s schedule tick.
export function onPresenceTransition(listener: (present: boolean) => void): () => void {
  presenceListeners.add(listener);
  return () => presenceListeners.delete(listener);
}

// Presence facts for the display-adapter's power decision. `lastSeenMs`
// falls back to service start so "absent since boot" counts absence from
// boot rather than blanking instantly.
export function getPresenceState(): {
  available: boolean;
  present: boolean | null;
  lastSeenMs: number;
} {
  return {
    available: snapshot.available,
    present: snapshot.present,
    lastSeenMs: snapshot.lastPresentAt ? Date.parse(snapshot.lastPresentAt) : serviceStartMs,
  };
}

// A client viewing the Breathing app leases breathing mode and renews the
// lease while it stays active; the tick reverts to presence on expiry.
export function requestBreathingMode(): void {
  breathingLeaseUntil = Date.now() + BREATHING_LEASE_MS;
  setMode('breathing');
}

export function releaseBreathingMode(): void {
  breathingLeaseUntil = 0;
  setMode('presence');
}
