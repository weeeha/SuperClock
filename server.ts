import express from 'express';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { buildApiApp } from './server/api-mount';
import { initDisplayAdapter } from './server/display-adapter';
import { readDevice } from './server/fleet-store';
import { resolveDeviceId } from './server/resolve-device';

const __dirname = dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = parseInt(process.env.PORT || '3000', 10);

app.use(
  buildApiApp({
    publicRoot: join(__dirname, 'dist'),
    adminHost: process.env.ADMIN_HOST === 'true',
  }),
);

app.use(
  '/assets',
  express.static(join(__dirname, 'dist', 'assets'), {
    maxAge: '1y',
    immutable: true,
  }),
);

app.use(express.static(join(__dirname, 'dist')));

// Admin SPA fallback — any unmatched /admin/* route serves the admin entry.
app.get('/admin{/*splat}', (_req, res) => {
  res.sendFile(join(__dirname, 'dist', 'admin', 'index.html'));
});

// Kiosk SPA fallback — everything else.
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
    console.log(
      `  chromium --kiosk --ozone-platform=wayland --password-store=basic --use-mock-keychain http://<this-ip>:${PORT}\n`,
    );
  });

  // Apply persisted brightness/sleep to the physical panel on this device
  // (and start the sleep-schedule evaluator). Safely no-ops off-Pi, with no
  // Wayland session, or without wlr-randr — never blocks the server.
  void initDisplayAdapter(() => readDevice(resolveDeviceId()));
});
