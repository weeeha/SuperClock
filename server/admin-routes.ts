import { Router } from 'express';
import { timingSafeEqual } from 'node:crypto';
import { ulid } from 'ulid';
import { readFleet, readDevice, updateDevice } from './fleet-store';
import { pushToDevice, getReachability } from './device-push';
import { adminTokenMiddleware, getAdminToken } from './admin-token';
import {
  ALL_DEVICE_IDS,
  type DeviceConfig,
  type DeviceId,
  type FleetHealth,
  type ScreenInstance,
} from '../src/shared/types';

const router: Router = Router();

// /auth/exchange is PUBLIC — bootstraps the session cookie from a one-time token.
// It must be registered before the auth middleware so unauthenticated users can hit it.
router.post('/auth/exchange', async (req, res) => {
  const expected = await getAdminToken();
  if (!expected) {
    res.status(204).end(); // no token configured = open mode (dev)
    return;
  }
  const body = req.body as { token?: string } | undefined;
  const provided = body?.token ?? '';
  if (
    provided.length === expected.length &&
    timingSafeEqual(Buffer.from(provided), Buffer.from(expected))
  ) {
    res.cookie('superclock-admin', expected, {
      httpOnly: true,
      sameSite: 'strict',
      maxAge: 365 * 24 * 60 * 60 * 1000,
      path: '/',
    });
    res.json({ ok: true });
    return;
  }
  res.status(401).json({ error: 'invalid token' });
});

// All admin routes below this require a valid session cookie or bearer token.
router.use(adminTokenMiddleware);

function isDeviceId(id: string): id is DeviceId {
  return (ALL_DEVICE_IDS as readonly string[]).includes(id);
}

router.get('/fleet', async (_req, res) => {
  const fleet = await readFleet();
  res.json(fleet);
});

router.get('/health', (_req, res) => {
  const reach = getReachability();
  const payload: FleetHealth = {
    devices: ALL_DEVICE_IDS.map((id) => {
      const s = reach.get(id);
      return {
        id,
        reachable: s?.reachable ?? false,
        lastSeen: s?.lastSeen ? s.lastSeen.toISOString() : null,
        pending: s?.pending ?? false,
      };
    }),
  };
  res.json(payload);
});

router.get('/fleet/:deviceId', async (req, res) => {
  if (!isDeviceId(req.params.deviceId)) {
    res.status(404).json({ error: 'unknown device' });
    return;
  }
  const config = await readDevice(req.params.deviceId);
  res.json(config);
});

router.patch('/fleet/:deviceId', async (req, res) => {
  if (!isDeviceId(req.params.deviceId)) {
    res.status(404).json({ error: 'unknown device' });
    return;
  }
  const deviceId = req.params.deviceId;
  const patch = req.body as Partial<DeviceConfig> | undefined;
  if (!patch || typeof patch !== 'object') {
    res.status(400).json({ error: 'body must be an object' });
    return;
  }
  const updated = await updateDevice(deviceId, (current) => ({ ...current, ...patch }));
  void pushToDevice(deviceId, updated);
  res.json(updated);
});

router.post('/fleet/:deviceId/instances', async (req, res) => {
  if (!isDeviceId(req.params.deviceId)) {
    res.status(404).json({ error: 'unknown device' });
    return;
  }
  const deviceId = req.params.deviceId;
  const body = req.body as Partial<ScreenInstance> | undefined;
  if (!body?.appId) {
    res.status(400).json({ error: 'appId required' });
    return;
  }
  const instance: ScreenInstance = {
    id: body.id ?? ulid(),
    appId: body.appId,
    config: body.config ?? {},
    label: body.label,
  };
  const updated = await updateDevice(deviceId, (current) => ({
    ...current,
    instances: [...current.instances, instance],
  }));
  void pushToDevice(deviceId, updated);
  res.json(instance);
});

router.patch('/fleet/:deviceId/instances/:id', async (req, res) => {
  if (!isDeviceId(req.params.deviceId)) {
    res.status(404).json({ error: 'unknown device' });
    return;
  }
  const deviceId = req.params.deviceId;
  const id = req.params.id;
  const patch = req.body as Partial<ScreenInstance> | undefined;
  if (!patch) {
    res.status(400).json({ error: 'body required' });
    return;
  }
  let nextInstance: ScreenInstance | undefined;
  const updated = await updateDevice(deviceId, (current) => ({
    ...current,
    instances: current.instances.map((i) => {
      if (i.id !== id) return i;
      nextInstance = { ...i, ...patch, id };
      return nextInstance;
    }),
  }));
  if (!nextInstance) {
    res.status(404).json({ error: 'instance not found' });
    return;
  }
  void pushToDevice(deviceId, updated);
  res.json(nextInstance);
});

router.delete('/fleet/:deviceId/instances/:id', async (req, res) => {
  if (!isDeviceId(req.params.deviceId)) {
    res.status(404).json({ error: 'unknown device' });
    return;
  }
  const deviceId = req.params.deviceId;
  const id = req.params.id;
  const updated = await updateDevice(deviceId, (current) => ({
    ...current,
    instances: current.instances.filter((i) => i.id !== id),
    playlist: { ...current.playlist, items: current.playlist.items.filter((x) => x !== id) },
  }));
  void pushToDevice(deviceId, updated);
  res.status(204).end();
});

router.post('/fleet/:deviceId/playlist/reorder', async (req, res) => {
  if (!isDeviceId(req.params.deviceId)) {
    res.status(404).json({ error: 'unknown device' });
    return;
  }
  const deviceId = req.params.deviceId;
  const body = req.body as { order?: string[] } | undefined;
  if (!body?.order || !Array.isArray(body.order)) {
    res.status(400).json({ error: 'order required' });
    return;
  }
  const order = body.order;
  const updated = await updateDevice(deviceId, (current) => ({
    ...current,
    playlist: { ...current.playlist, items: order },
  }));
  void pushToDevice(deviceId, updated);
  res.json(updated);
});

export default router;
