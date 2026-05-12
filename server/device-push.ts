import type { DeviceConfig, DeviceId } from '../src/shared/types';
import { STATIC_DEVICE_INFO } from '../src/shared/capabilities';
import { resolveDeviceId } from './resolve-device';

interface DeviceStatus {
  reachable: boolean;
  lastSeen: Date | null;
  pending: boolean;
}

const status = new Map<DeviceId, DeviceStatus>();

function update(id: DeviceId, patch: Partial<DeviceStatus>): void {
  const prev = status.get(id) ?? { reachable: false, lastSeen: null, pending: false };
  status.set(id, { ...prev, ...patch });
}

export function getReachability(): Map<DeviceId, DeviceStatus> {
  return status;
}

// Push the given config to the target device.
// For the admin Pi pushing to itself, fleet.json IS already the device's
// source of truth — skip the HTTP roundtrip; the device's polling will
// pick up the new config on its next 5s tick.
export async function pushToDevice(
  deviceId: DeviceId,
  config: DeviceConfig,
): Promise<{ ok: boolean; reason?: string }> {
  const ownId = resolveDeviceId();
  if (deviceId === ownId) {
    update(deviceId, { reachable: true, lastSeen: new Date(), pending: false });
    return { ok: true };
  }

  const host = STATIC_DEVICE_INFO[deviceId].host;
  const url = `http://${host}:3000/api/device/config`;

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(config),
      signal: AbortSignal.timeout(5000),
    });
    if (res.ok) {
      update(deviceId, { reachable: true, lastSeen: new Date(), pending: false });
      return { ok: true };
    }
    update(deviceId, { reachable: false, pending: true });
    return { ok: false, reason: `HTTP ${res.status}` };
  } catch (err) {
    update(deviceId, { reachable: false, pending: true });
    return { ok: false, reason: (err as Error).message };
  }
}
