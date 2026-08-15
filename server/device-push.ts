import type { DeviceConfig, DeviceId, PushOutcome } from '../src/shared/types';
import { STATIC_DEVICE_INFO } from '../src/shared/capabilities';
import { resolveDeviceId } from './resolve-device';
import { getAdminToken } from './admin-token';
import { readDevice } from './fleet-store';

export type { PushOutcome } from '../src/shared/types';

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

// Dev trap this closes: `npm run dev` on the Mac mounts the real admin
// routes, so editing any device ≠ self pushed config to REAL clocks.
export function classifyPush(
  target: DeviceId,
  own: DeviceId,
  nodeEnv: string | undefined,
  allowRemote: boolean,
): 'push' | 'suppress' {
  if (nodeEnv === 'production') return 'push';
  if (target === own) return 'push';
  return allowRemote ? 'push' : 'suppress';
}

// Push the given config to the target device.
// For the admin Pi pushing to itself, fleet.json IS already the device's
// source of truth — skip the HTTP roundtrip; the device's polling will
// pick up the new config on its next 5s tick.
export async function pushToDevice(
  deviceId: DeviceId,
  config: DeviceConfig,
): Promise<{ ok: boolean; outcome: PushOutcome; reason?: string }> {
  const ownId = resolveDeviceId();

  const verdict = classifyPush(
    deviceId,
    ownId,
    process.env.NODE_ENV,
    process.env.ADMIN_ALLOW_REMOTE_WRITES === '1',
  );
  // Suppressed pushes must NOT mark the device pending — the retry drain
  // would deliver the config to the real clock a minute later anyway.
  if (verdict === 'suppress') return { ok: true, outcome: 'dev-suppressed' };

  if (deviceId === ownId) {
    update(deviceId, { reachable: true, lastSeen: new Date(), pending: false });
    return { ok: true, outcome: 'applied' };
  }

  const host = STATIC_DEVICE_INFO[deviceId].host;
  // Fleet-wide assumption: every device runs the server on the same port
  // (setup-pi.sh's PORT override applies to the whole fleet, not per-device).
  const port = process.env.PORT || '3000';
  const url = `http://${host}:${port}/api/device/config`;

  // Authenticate the push when this admin host has a token; devices that
  // have the same config/admin.json provisioned will require it.
  const token = await getAdminToken();
  const headers: Record<string, string> = { 'content-type': 'application/json' };
  if (token && token !== 'unavailable') headers.authorization = `Bearer ${token}`;

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify(config),
      signal: AbortSignal.timeout(5000),
    });
    if (res.ok) {
      update(deviceId, { reachable: true, lastSeen: new Date(), pending: false });
      return { ok: true, outcome: 'applied' };
    }
    update(deviceId, { reachable: false, pending: true });
    return { ok: false, outcome: 'queued', reason: `HTTP ${res.status}` };
  } catch (err) {
    update(deviceId, { reachable: false, pending: true });
    return { ok: false, outcome: 'queued', reason: (err as Error).message };
  }
}

// Remote kiosks poll their OWN server, not the admin host, so a failed push
// used to strand a device on stale config forever ("pending" with no drain).
// This loop re-pushes the current stored config to any pending device.
const RETRY_INTERVAL_MS = 60_000;
let retryTimer: ReturnType<typeof setInterval> | null = null;

export function startPushRetryLoop(): void {
  if (retryTimer !== null) return;
  retryTimer = setInterval(() => {
    void (async () => {
      for (const [deviceId, s] of status) {
        if (!s.pending) continue;
        const config = await readDevice(deviceId);
        const result = await pushToDevice(deviceId, config);
        if (result.ok) console.log(`[device-push] drained pending push to ${deviceId}`);
      }
    })().catch(() => undefined);
  }, RETRY_INTERVAL_MS);
  retryTimer.unref?.();
}

export function stopPushRetryLoop(): void {
  if (retryTimer !== null) {
    clearInterval(retryTimer);
    retryTimer = null;
  }
}
