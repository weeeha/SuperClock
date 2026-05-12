import express, { type Express } from 'express';
import { join } from 'node:path';
import { getCalendarEvents, listPhotos } from './handlers';
import deviceRoutes from './device-routes';
import adminRoutes from './admin-routes';

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

  app.use('/api/device', deviceRoutes);

  if (opts.adminHost) {
    app.use('/api/admin', adminRoutes);
  }

  return app;
}
