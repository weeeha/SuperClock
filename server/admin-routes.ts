import { Router, type Response } from 'express';
import { ulid } from 'ulid';
import { readFleet, readDevice, updateDevice } from './fleet-store';
import { pushToDevice, getReachability } from './device-push';
import { adminTokenMiddleware, getAdminToken, compareToken } from './admin-token';
import {
  deviceConfigPatchSchema,
  screenInstanceSchema,
} from '../src/shared/device-config-schema';
import { STATIC_DEVICE_INFO } from '../src/shared/capabilities';
import {
  ALL_DEVICE_IDS,
  type DeviceId,
  type FleetHealth,
  type ScreenInstance,
} from '../src/shared/types';
import { z } from 'zod';

const router: Router = Router();

// /auth/exchange is PUBLIC — bootstraps the session cookie from a one-time token.
// It must be registered before the auth middleware so unauthenticated users can hit it.
router.post('/auth/exchange', async (req, res) => {
  const expected = await getAdminToken();
  if (expected === 'unavailable') {
    res.status(503).json({ error: 'auth temporarily unavailable' });
    return;
  }
  if (!expected) {
    res.status(204).end(); // no token configured = open mode (dev)
    return;
  }
  const body = req.body as { token?: string } | undefined;
  const provided = body?.token ?? '';
  if (compareToken(provided, expected)) {
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

// Central :deviceId guard — every route below gets a validated id.
router.param('deviceId', (_req, res, next, id: string) => {
  if (!isDeviceId(id)) {
    res.status(404).json({ error: 'unknown device' });
    return;
  }
  next();
});

// Mutations against read-only devices (the LVGL slow clock) would persist to
// fleet.json, then push → 405 → device flagged pending forever while the
// stored config silently diverges from the device. Reject them up front.
function guardWritable(deviceId: DeviceId, res: Response): boolean {
  if (STATIC_DEVICE_INFO[deviceId].readOnly) {
    res.status(405).json({ error: 'device is read-only' });
    return false;
  }
  return true;
}

function sendValidationError(res: Response, error: z.ZodError): void {
  res.status(400).json({
    error: 'invalid body',
    issues: error.issues.map((i) => ({ path: i.path.join('.'), message: i.message })),
  });
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
  const config = await readDevice(req.params.deviceId as DeviceId);
  res.json(config);
});

router.patch('/fleet/:deviceId', async (req, res) => {
  const deviceId = req.params.deviceId as DeviceId;
  if (!guardWritable(deviceId, res)) return;
  const parsed = deviceConfigPatchSchema.safeParse(req.body);
  if (!parsed.success) {
    sendValidationError(res, parsed.error);
    return;
  }
  const patch = parsed.data;
  const updated = await updateDevice(deviceId, (current) => ({ ...current, ...patch }));
  void pushToDevice(deviceId, updated);
  res.json(updated);
});

const instanceCreateSchema = screenInstanceSchema.partial({ id: true, config: true });

router.post('/fleet/:deviceId/instances', async (req, res) => {
  const deviceId = req.params.deviceId as DeviceId;
  if (!guardWritable(deviceId, res)) return;
  const parsed = instanceCreateSchema.safeParse(req.body);
  if (!parsed.success) {
    sendValidationError(res, parsed.error);
    return;
  }
  const body = parsed.data;
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

const instancePatchSchema = screenInstanceSchema.partial();

router.patch('/fleet/:deviceId/instances/:id', async (req, res) => {
  const deviceId = req.params.deviceId as DeviceId;
  if (!guardWritable(deviceId, res)) return;
  const id = req.params.id;
  const parsed = instancePatchSchema.safeParse(req.body);
  if (!parsed.success) {
    sendValidationError(res, parsed.error);
    return;
  }
  const patch = parsed.data;
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
  const deviceId = req.params.deviceId as DeviceId;
  if (!guardWritable(deviceId, res)) return;
  const id = req.params.id;
  const updated = await updateDevice(deviceId, (current) => ({
    ...current,
    instances: current.instances.filter((i) => i.id !== id),
    playlist: { ...current.playlist, items: current.playlist.items.filter((x) => x !== id) },
  }));
  void pushToDevice(deviceId, updated);
  res.status(204).end();
});

const reorderSchema = z.object({ order: z.array(z.string()) });

router.post('/fleet/:deviceId/playlist/reorder', async (req, res) => {
  const deviceId = req.params.deviceId as DeviceId;
  if (!guardWritable(deviceId, res)) return;
  const parsed = reorderSchema.safeParse(req.body);
  if (!parsed.success) {
    sendValidationError(res, parsed.error);
    return;
  }
  const order = parsed.data.order;
  const updated = await updateDevice(deviceId, (current) => ({
    ...current,
    playlist: { ...current.playlist, items: order },
  }));
  void pushToDevice(deviceId, updated);
  res.json(updated);
});

export default router;
