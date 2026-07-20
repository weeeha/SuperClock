import express, { type Express } from 'express';
import { join } from 'node:path';
import { getCalendarEvents, listPhotos } from './handlers';
import { claudeUsageHandler } from './claude-usage-proxy';
import { githubContributionsHandler } from './github-proxy';
import deviceRoutes from './device-routes';
import adminRoutes from './admin-routes';
import radarRoutes from './radar/routes';
import { initRadarService } from './radar/service';
import { getOccupancySummary, initOccupancyService } from './occupancy/service';
import { startPushRetryLoop } from './device-push';

interface MountOptions {
  publicRoot: string; // for /api/photos directory lookup
  adminHost: boolean; // when true, mount /api/admin/* routes
}

// Builds an Express app that handles the /api/* surface.
// Used as Connect middleware in dev (vite.config.ts) and mounted on the
// main Express server in prod (server.ts). When used as middleware,
// unmatched requests fall through via next() — Express's default 404 only
// fires when an app is the top-level handler via .listen().
export function buildApiApp(opts: MountOptions): Express {
  const app: Express = express();

  app.use(express.json());

  app.get('/api/health', (_req, res) => {
    res.json({ ok: true, uptime: process.uptime() });
  });

  app.get('/api/calendar', async (_req, res) => {
    const events = await getCalendarEvents(process.env.CALENDAR_ICS_URL ?? '');
    res.json(events);
  });

  app.get('/api/photos', async (_req, res) => {
    const photos = await listPhotos(join(opts.publicRoot, 'photos'));
    res.json(photos);
  });

  app.get('/api/claude-usage', claudeUsageHandler);

  app.get('/api/github/contributions', githubContributionsHandler);

  app.use('/api/device', deviceRoutes);

  // A121 mmWave radar (presence / breathing). Service self-starts here so
  // both the dev middleware and the prod server get it without extra wiring;
  // it no-ops into "unavailable" when no sensor is attached.
  initRadarService();
  app.use('/api/radar', radarRoutes);

  // Desk-occupancy log derived from radar presence (Time Tracking app).
  initOccupancyService();
  app.get('/api/occupancy', (_req, res) => {
    res.json(getOccupancySummary());
  });

  if (opts.adminHost) {
    app.use('/api/admin', adminRoutes);
    // Only the admin host pushes config to other devices; drain failed pushes.
    startPushRetryLoop();
  }

  // Unmatched /api/* must 404 as JSON here — falling through to the SPA
  // fallback returns 200 text/html and clients report a misleading
  // "Unexpected token '<'" instead of a real error.
  app.all('/api/{*splat}', (_req, res) => {
    res.status(404).json({ error: 'not found' });
  });

  return app;
}
