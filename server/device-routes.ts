import { Router } from 'express';
import { readDevice, updateDevice } from './fleet-store';
import { buildCapabilities, STATIC_DEVICE_INFO } from '../src/shared/capabilities';
import { deviceConfigPatchSchema } from '../src/shared/device-config-schema';
import type { DeviceState } from '../src/shared/types';
import { resolveDeviceId } from './resolve-device';
import { adminTokenMiddleware } from './admin-token';

const router: Router = Router();

router.get('/capabilities', (_req, res) => {
  const deviceId = resolveDeviceId();
  res.json(buildCapabilities(deviceId));
});

router.get('/state', (_req, res) => {
  const state: DeviceState = {
    currentScreenId: null,
    uptimeMs: Math.round(process.uptime() * 1000),
    lastConfigAt: null,
  };
  res.json(state);
});

router.get('/config', async (_req, res) => {
  const deviceId = resolveDeviceId();
  const config = await readDevice(deviceId);
  res.json(config);
});

// The only WRITE on the device surface — this is what the admin host's
// pushToDevice calls. Token-gated when this device has config/admin.json
// provisioned (same file/format as the admin host; copy it to each Pi to
// require authenticated pushes). Without the file it stays open — matching
// the admin surface's own dev behavior — but the body is always validated:
// a mis-shaped config would be persisted and crash the kiosk on every poll.
router.post('/config', adminTokenMiddleware, async (req, res) => {
  const deviceId = resolveDeviceId();
  const info = STATIC_DEVICE_INFO[deviceId];
  if (info.readOnly) {
    res.status(405).json({ error: 'device is read-only' });
    return;
  }
  const parsed = deviceConfigPatchSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({
      error: 'invalid config',
      issues: parsed.error.issues.map((i) => ({
        path: i.path.join('.'),
        message: i.message,
      })),
    });
    return;
  }
  const updated = await updateDevice(deviceId, (current) => ({
    ...current,
    ...parsed.data,
    deviceId,
  }));
  res.json(updated);
});

export default router;
