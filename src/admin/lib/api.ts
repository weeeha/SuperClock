import type {
  DeviceCapabilities,
  DeviceConfig,
  DeviceId,
  FleetConfig,
  FleetHealth,
  ScreenInstance,
} from '../../shared/types';

function handleUnauthorized(): void {
  if (typeof window === 'undefined') return;
  if (window.location.pathname.endsWith('/setup')) return;
  window.location.href = '/admin/setup';
}

async function jsonGet<T>(path: string): Promise<T | null> {
  const res = await fetch(path, { credentials: 'include' });
  if (res.status === 401) {
    handleUnauthorized();
    return null;
  }
  if (!res.ok) return null;
  return (await res.json()) as T;
}

async function jsonRequest<T>(
  method: 'POST' | 'PATCH' | 'DELETE',
  path: string,
  body?: unknown,
): Promise<T> {
  const res = await fetch(path, {
    method,
    credentials: 'include',
    headers: { 'content-type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  if (res.status === 401) {
    handleUnauthorized();
    throw new Error('unauthorized — redirecting to setup');
  }
  if (!res.ok) throw new Error(`${method} ${path} → ${res.status}`);
  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

export const adminApi = {
  getOwnCapabilities: () => jsonGet<DeviceCapabilities>('/api/device/capabilities'),
  getFleet: () => jsonGet<FleetConfig>('/api/admin/fleet'),
  getFleetHealth: () => jsonGet<FleetHealth>('/api/admin/health'),
  getDevice: (deviceId: DeviceId) => jsonGet<DeviceConfig>(`/api/admin/fleet/${deviceId}`),
  patchDevice: (deviceId: DeviceId, patch: Partial<DeviceConfig>) =>
    jsonRequest<DeviceConfig>('PATCH', `/api/admin/fleet/${deviceId}`, patch),
  createInstance: (deviceId: DeviceId, instance: Partial<ScreenInstance> & { appId: string }) =>
    jsonRequest<ScreenInstance>('POST', `/api/admin/fleet/${deviceId}/instances`, instance),
  patchInstance: (deviceId: DeviceId, id: string, patch: Partial<ScreenInstance>) =>
    jsonRequest<ScreenInstance>('PATCH', `/api/admin/fleet/${deviceId}/instances/${id}`, patch),
  deleteInstance: (deviceId: DeviceId, id: string) =>
    jsonRequest<void>('DELETE', `/api/admin/fleet/${deviceId}/instances/${id}`),
  reorderPlaylist: (deviceId: DeviceId, order: string[]) =>
    jsonRequest<DeviceConfig>('POST', `/api/admin/fleet/${deviceId}/playlist/reorder`, { order }),
};

// Backwards-compat exports for already-imported functions.
export const getOwnCapabilities = adminApi.getOwnCapabilities;
export const getFleet = adminApi.getFleet;
export const getFleetHealth = adminApi.getFleetHealth;
