import express, { type Router } from 'express';
import {
  getRadarSnapshot,
  releaseBreathingMode,
  requestBreathingMode,
  subscribeRadar,
} from './service';
import type { RadarSnapshot } from '../../src/shared/radar';

const SSE_HEARTBEAT_MS = 15_000;

const router: Router = express.Router();

router.get('/', (_req, res) => {
  res.json(getRadarSnapshot());
});

// Server-sent events stream of snapshot updates. EventSource on the client
// reconnects automatically, so no resume bookkeeping is needed.
router.get('/stream', (req, res) => {
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    Connection: 'keep-alive',
  });

  const send = (s: RadarSnapshot) => {
    res.write(`data: ${JSON.stringify(s)}\n\n`);
  };
  send(getRadarSnapshot());

  const unsubscribe = subscribeRadar(send);
  const heartbeat = setInterval(() => {
    res.write(': ping\n\n');
  }, SSE_HEARTBEAT_MS);
  heartbeat.unref?.();

  req.on('close', () => {
    clearInterval(heartbeat);
    unsubscribe();
  });
});

router.post('/mode', (req, res) => {
  const mode = (req.body as { mode?: unknown } | undefined)?.mode;
  if (mode !== 'presence' && mode !== 'breathing') {
    res.status(400).json({ error: "mode must be 'presence' or 'breathing'" });
    return;
  }
  if (mode === 'breathing') requestBreathingMode();
  else releaseBreathingMode();
  res.json(getRadarSnapshot());
});

export default router;
