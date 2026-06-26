import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import {
  ALL_DEVICE_IDS,
  emptyDeviceConfig,
  type DeviceConfig,
  type DeviceId,
  type FleetConfig,
} from '../src/shared/types';
import { STATIC_DEVICE_INFO } from '../src/shared/capabilities';
import { resolveDeviceId } from './resolve-device';
import { applyDisplaySettings } from './display-adapter';

const FLEET_PATH = join(process.cwd(), 'config', 'fleet.json');
const FLEET_EXAMPLE_PATH = join(process.cwd(), 'config', 'fleet.example.json');
const FLEET_SCHEMA_VERSION = 2;

let writeLock: Promise<unknown> = Promise.resolve();

function defaultFleet(): FleetConfig {
  return {
    devices: ALL_DEVICE_IDS.map(emptyDeviceConfig),
    version: 0,
    schemaVersion: FLEET_SCHEMA_VERSION,
  };
}

async function readJson<T>(path: string): Promise<T | null> {
  try {
    const raw = await readFile(path, 'utf8');
    return JSON.parse(raw) as T;
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === 'ENOENT') return null;
    throw err;
  }
}

export async function readFleet(): Promise<FleetConfig> {
  const fromDisk = await readJson<FleetConfig>(FLEET_PATH);
  if (fromDisk) return fromDisk;
  const example = await readJson<FleetConfig>(FLEET_EXAMPLE_PATH);
  return example ?? defaultFleet();
}

async function writeFleetAtomic(fleet: FleetConfig): Promise<void> {
  await mkdir(dirname(FLEET_PATH), { recursive: true });
  const tmp = `${FLEET_PATH}.${process.pid}.${Date.now()}.tmp`;
  await writeFile(tmp, JSON.stringify(fleet, null, 2) + '\n', 'utf8');
  await rename(tmp, FLEET_PATH);
}

export async function writeFleet(fleet: FleetConfig): Promise<FleetConfig> {
  const next: FleetConfig = { ...fleet, version: fleet.version + 1 };
  writeLock = writeLock.then(() => writeFleetAtomic(next));
  await writeLock;
  return next;
}

export async function updateDevice(
  deviceId: DeviceId,
  updater: (config: DeviceConfig) => DeviceConfig,
): Promise<DeviceConfig> {
  const fleet = await readFleet();
  let updated: DeviceConfig | null = null;
  const devices = fleet.devices.map((d) => {
    if (d.deviceId !== deviceId) return d;
    updated = {
      ...updater(d),
      deviceId,
      updatedAt: new Date().toISOString(),
    };
    return updated;
  });
  if (!updated) {
    updated = {
      ...updater(emptyDeviceConfig(deviceId)),
      deviceId,
      updatedAt: new Date().toISOString(),
    };
    devices.push(updated);
  }
  await writeFleet({ ...fleet, devices });
  // If the device whose config just changed is the one this server runs on,
  // reconcile the physical panel. The adapter diffs against last-applied
  // state, so this is a cheap no-op unless brightness/sleep actually moved
  // (and a permanent no-op off-Pi / in dev).
  if (updated.deviceId === resolveDeviceId()) {
    applyDisplaySettings(updated);
  }
  return updated;
}

export async function readDevice(deviceId: DeviceId): Promise<DeviceConfig> {
  const fleet = await readFleet();
  const existing = fleet.devices.find((d) => d.deviceId === deviceId);
  return existing ?? emptyDeviceConfig(deviceId);
}

// One-time, idempotent schema migrations, called at server startup.
// v1: `theme` was a visual no-op before night mode shipped, so stored 'dark'
// values carry no user intent — normalize kiosk devices to 'system' (Auto) so
// daytime keeps today's light faces and the night window takes effect.
// v2: day `brightness` was a no-op too (wlr-randr has no --brightness flag),
// and the admin form baked its default (80) into every settings save while
// the slider was inert — stored values carry no intent. Now that the kiosk
// honors brightness via a CSS filter, clear them so panels don't
// surprise-dim on deploy.
export async function migrateFleet(): Promise<void> {
  const fleet = await readFleet();
  const from = fleet.schemaVersion ?? 0;
  if (from >= FLEET_SCHEMA_VERSION) return;
  const devices = fleet.devices.map((d) => {
    if (STATIC_DEVICE_INFO[d.deviceId]?.kind !== 'kiosk') return d;
    let settings = d.settings;
    if (from < 1 && settings.theme === 'dark') {
      settings = { ...settings, theme: 'system' as const };
    }
    if (from < 2 && settings.brightness !== undefined) {
      // undefined → key dropped on the next JSON serialize.
      settings = { ...settings, brightness: undefined };
    }
    if (settings === d.settings) return d;
    // Stamp updatedAt so polling kiosks adopt the migrated values (their cache
    // change-detection keys on updatedAt).
    return { ...d, settings, updatedAt: new Date().toISOString() };
  });
  await writeFleet({ ...fleet, devices, schemaVersion: FLEET_SCHEMA_VERSION });
}
