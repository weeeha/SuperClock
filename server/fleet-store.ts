import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import {
  ALL_DEVICE_IDS,
  emptyDeviceConfig,
  type DeviceConfig,
  type DeviceId,
  type FleetConfig,
} from '../src/shared/types';

const FLEET_PATH = join(process.cwd(), 'config', 'fleet.json');
const FLEET_EXAMPLE_PATH = join(process.cwd(), 'config', 'fleet.example.json');

let writeLock: Promise<unknown> = Promise.resolve();

function defaultFleet(): FleetConfig {
  return {
    devices: ALL_DEVICE_IDS.map(emptyDeviceConfig),
    version: 0,
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
  return updated;
}

export async function readDevice(deviceId: DeviceId): Promise<DeviceConfig> {
  const fleet = await readFleet();
  const existing = fleet.devices.find((d) => d.deviceId === deviceId);
  return existing ?? emptyDeviceConfig(deviceId);
}
