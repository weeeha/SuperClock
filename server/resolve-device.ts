import os from 'node:os';
import { ALL_DEVICE_IDS, type DeviceId } from '../src/shared/types';

// Resolves which device this Express process is running on.
// Priority: env DEVICE_ID > os.hostname() (if it matches a locked DeviceId) > dev fallback.
export function resolveDeviceId(): DeviceId {
  const fromEnv = process.env.DEVICE_ID;
  if (fromEnv && (ALL_DEVICE_IDS as readonly string[]).includes(fromEnv)) {
    return fromEnv as DeviceId;
  }
  const hostname = os.hostname().split('.')[0];
  if ((ALL_DEVICE_IDS as readonly string[]).includes(hostname)) {
    return hostname as DeviceId;
  }
  // Dev fallback — local machine isn't named superclock-* but we still
  // want /api/device/* to return something useful during development.
  return 'superclock-fast';
}
