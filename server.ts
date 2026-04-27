import express from 'express';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { getCalendarEvents, listPhotos } from './server/handlers';

const __dirname = dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = parseInt(process.env.PORT || '3000', 10);

app.get('/api/health', (_req, res) => {
  res.json({ ok: true, uptime: process.uptime() });
});

app.get('/api/calendar', async (_req, res) => {
  const events = await getCalendarEvents(process.env.CALENDAR_ICS_URL ?? '');
  res.json(events);
});

app.get('/api/photos', async (_req, res) => {
  const photos = await listPhotos(join(__dirname, 'dist', 'photos'));
  res.json(photos);
});

app.use(
  '/assets',
  express.static(join(__dirname, 'dist', 'assets'), {
    maxAge: '1y',
    immutable: true,
  }),
);

app.use(express.static(join(__dirname, 'dist')));

app.get('/{*splat}', (_req, res) => {
  res.sendFile(join(__dirname, 'dist', 'index.html'));
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`\n  SuperClock server running at:`);
  console.log(`  → http://localhost:${PORT}`);

  import('os').then(({ networkInterfaces }) => {
    const nets = networkInterfaces();
    for (const name of Object.keys(nets)) {
      for (const net of nets[name] || []) {
        if (net.family === 'IPv4' && !net.internal) {
          console.log(`  → http://${net.address}:${PORT}`);
        }
      }
    }
    console.log(`\n  Open this URL in Chromium kiosk mode on your Pi:\n`);
    console.log(`  chromium-browser --kiosk http://<this-ip>:${PORT}\n`);
  });
});
