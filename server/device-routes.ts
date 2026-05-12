import { Router } from 'express';
import { readDevice, updateDevice } from './fleet-store';
import { buildCapabilities, STATIC_DEVICE_INFO } from '../src/shared/capabilities';
import type { DeviceConfig, DeviceState } from '../src/shared/types';
import { resolveDeviceId } from './resolve-device';

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

router.post('/config', async (req, res) => {
  const deviceId = resolveDeviceId();
  const info = STATIC_DEVICE_INFO[deviceId];
  if (info.readOnly) {
    res.status(405).json({ error: 'device is read-only' });
    return;
  }
  const body = req.body as Partial<DeviceConfig> | undefined;
  if (!body || typeof body !== 'object') {
    res.status(400).json({ error: 'body must be a DeviceConfig object' });
    return;
  }
  const updated = await updateDevice(deviceId, (current) => ({
    ...current,
    ...body,
    deviceId,
  }));
  res.json(updated);
});

export default router;
