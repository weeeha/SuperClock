import os from 'node:os';
import { ALL_DEVICE_IDS, type DeviceId } from '../src/shared/types';

// Hostnames the fleet actually has (verified over SSH 2026-08-07) that don't
// equal their DeviceId even after normalization: fastclock never got its
// hyphen, squareclock was provisioned with a typo. Keys are normalized
// (first label, lowercased).
const HOSTNAME_ALIASES: Record<string, DeviceId> = {
  superclockfast: 'superclock-fast',
  'superclok-square': 'superclock-square',
};

export type IdentitySource = 'env' | 'hostname' | 'alias' | 'fallback';

// 'SuperClock-Small.local' → 'superclock-small'
function normalize(candidate: string): string {
  return candidate.trim().split('.')[0].toLowerCase();
}

function matchDeviceId(candidate: string): { id: DeviceId; alias: boolean } | null {
  const normalized = normalize(candidate);
  if ((ALL_DEVICE_IDS as readonly string[]).includes(normalized)) {
    return { id: normalized as DeviceId, alias: false };
  }
  const aliased = HOSTNAME_ALIASES[normalized];
  return aliased ? { id: aliased, alias: true } : null;
}

// Pure resolution core, unit-tested without touching process/os (same
// pure-fn + thin-dispatcher split as gesture-resolve).
// Priority: env DEVICE_ID > hostname (direct or alias) > dev fallback.
export function resolveDeviceIdentity(
  env: string | undefined,
  hostname: string,
): { id: DeviceId; source: IdentitySource } {
  if (env) {
    const fromEnv = matchDeviceId(env);
    if (fromEnv) return { id: fromEnv.id, source: 'env' };
  }
  const fromHost = matchDeviceId(hostname);
  if (fromHost) {
    return { id: fromHost.id, source: fromHost.alias ? 'alias' : 'hostname' };
  }
  // Dev fallback — local machine isn't named superclock-* but we still
  // want /api/device/* to return something useful during development.
  return { id: 'superclock-fast', source: 'fallback' };
}

let cached: DeviceId | null = null;

// Resolves which device this Express process is running on. Env and hostname
// can't change under a running process, so this resolves once and logs how —
// a misidentified device must be visible in journalctl, not silently serve
// another device's capabilities profile (the pre-2026-08 bug: every Pi fell
// through to the fallback and claimed to be superclock-fast).
export function resolveDeviceId(): DeviceId {
  if (cached) return cached;
  const env = process.env.DEVICE_ID;
  const hostname = os.hostname();
  const { id, source } = resolveDeviceIdentity(env, hostname);
  if (env && source !== 'env') {
    console.warn(
      `[resolve-device] DEVICE_ID='${env}' is not a known device id — ignoring it`,
    );
  }
  if (source === 'fallback') {
    console.warn(
      `[resolve-device] hostname '${hostname}' matches no device id — defaulting to '${id}'. ` +
        `On a real device set DEVICE_ID in /etc/default/superclock or fix the hostname.`,
    );
  } else {
    const detail = source === 'env' ? env : hostname;
    console.log(`[resolve-device] device identity: ${id} (${source}: '${detail}')`);
  }
  cached = id;
  return id;
}
