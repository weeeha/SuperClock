import { Router } from 'express';
import { execFile } from 'node:child_process';
import { fleetEvents, readDevice, updateDevice } from './fleet-store';
import { buildCapabilities, STATIC_DEVICE_INFO } from '../src/shared/capabilities';
import { deviceConfigPatchSchema } from '../src/shared/device-config-schema';
import type { DeviceConfig, DeviceState } from '../src/shared/types';
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

// Wi-Fi STATUS for the kiosk quick-settings sheet. Read-only by design:
// a network toggle on a device administered over wifi is a footgun
// (spec 2026-07-24, decision 3b).
router.get('/network', (_req, res) => {
  execFile('iwgetid', ['-r'], { timeout: 2000 }, (err, stdout) => {
    const ssid = err ? null : stdout.trim() || null;
    res.json({ ssid, connected: ssid !== null });
  });
});

// How often a comment frame goes out on an idle stream.
const HEARTBEAT_MS = 30_000;

// Server-sent config stream. Sends this device's config on connect, then
// again on every persisted change to it.
//
// The 60s poll in src/shared/local-config.ts remains as the fallback, so a
// dropped stream costs latency, never correctness: EventSource reconnects on
// its own and the localStorage last-good cache is untouched either way.
router.get('/config/stream', async (req, res) => {
  const deviceId = resolveDeviceId();
  res.set({
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-store',
    Connection: 'keep-alive',
    // Belt and braces if a reverse proxy is ever put in front of a Pi:
    // buffering an event stream defeats the point of it.
    'X-Accel-Buffering': 'no',
  });
  res.flushHeaders();

  const send = (config: DeviceConfig) => res.write(`data: ${JSON.stringify(config)}\n\n`);

  send(await readDevice(deviceId));

  const onChange = (config: DeviceConfig) => {
    if (config.deviceId === deviceId) send(config);
  };
  fleetEvents.on('device-changed', onChange);

  // Comment frames so an idle connection is not reaped by any timeout between
  // the kiosk's Chromium and this server.
  const heartbeat = setInterval(() => res.write(': ping\n\n'), HEARTBEAT_MS);

  // A kiosk holds this open for weeks and reconnects on every network blip;
  // without both of these, listeners and timers accumulate one per reconnect.
  req.on('close', () => {
    clearInterval(heartbeat);
    fleetEvents.off('device-changed', onChange);
  });
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
