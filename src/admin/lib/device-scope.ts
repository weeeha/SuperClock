import { useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ALL_DEVICE_IDS, type DeviceId } from '../../shared/types';
import { adminApi } from './api';

// The URL is the single source of truth for device scope (spec: no global
// device state survives the IA v2 cutover). Everything under
// /clock/:deviceId renders inside <DeviceScope>, so useDeviceId() can assume
// a validated param.

export const LEGACY_REDIRECTS: Record<string, string> = {
  '/apps': '/',
  '/apps/*': '/',
  '/playlist': '/',
  '/settings': '/',
};

export function resolveDeviceParam(param: string | undefined): DeviceId | null {
  if (!param) return null;
  return (ALL_DEVICE_IDS as readonly string[]).includes(param) ? (param as DeviceId) : null;
}

export function deviceDisplayName(id: DeviceId): string {
  const short = id.replace(/^superclock-/, '');
  return short[0].toUpperCase() + short.slice(1);
}

export function useDeviceId(): DeviceId {
  const { deviceId } = useParams();
  const resolved = resolveDeviceParam(deviceId);
  if (!resolved) throw new Error('useDeviceId used outside a validated DeviceScope route');
  return resolved;
}

export interface DeviceStatus {
  reachable: boolean;
  lastSeen: string | null;
  known: boolean; // false while the health query has not resolved yet
}

/** Shared ['health'] cache (30s visibility-gated poll) filtered to one device. */
export function useDeviceStatus(deviceId: DeviceId): DeviceStatus {
  const health = useQuery({
    queryKey: ['health'],
    queryFn: adminApi.getFleetHealth,
    refetchInterval: 30_000,
  });
  const entry = health.data?.devices.find((d) => d.id === deviceId);
  if (!entry) return { reachable: false, lastSeen: null, known: false };
  return { reachable: entry.reachable, lastSeen: entry.lastSeen, known: true };
}
