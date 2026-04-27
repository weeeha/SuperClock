import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { getCalendarEvents, listPhotos } from './server/handlers';

const __dirname = dirname(fileURLToPath(import.meta.url));

function superclockApi(): Plugin {
  return {
    name: 'superclock-api',
    configureServer(server) {
      server.middlewares.use('/api/calendar', async (_req, res) => {
        const events = await getCalendarEvents(process.env.CALENDAR_ICS_URL ?? '');
        res.setHeader('content-type', 'application/json');
        res.end(JSON.stringify(events));
      });
      server.middlewares.use('/api/photos', async (_req, res) => {
        const photos = await listPhotos(join(__dirname, 'public/photos'));
        res.setHeader('content-type', 'application/json');
        res.end(JSON.stringify(photos));
      });
      server.middlewares.use('/api/health', (_req, res) => {
        res.setHeader('content-type', 'application/json');
        res.end(JSON.stringify({ ok: true, uptime: process.uptime() }));
      });
    },
  };
}

export default defineConfig({
  plugins: [react(), tailwindcss(), superclockApi()],
  build: {
    target: 'es2020',
  },
});
