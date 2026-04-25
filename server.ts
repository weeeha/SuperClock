import express from 'express';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = parseInt(process.env.PORT || '3000', 10);

// Serve static build files with aggressive caching for assets
app.use(
  '/assets',
  express.static(join(__dirname, 'dist', 'assets'), {
    maxAge: '1y',
    immutable: true,
  }),
);

app.use(express.static(join(__dirname, 'dist')));

// SPA fallback — serve index.html for all other routes
app.get('/{*splat}', (_req, res) => {
  res.sendFile(join(__dirname, 'dist', 'index.html'));
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`\n  SuperClock server running at:`);
  console.log(`  → http://localhost:${PORT}`);

  // Show LAN IP for Pi access
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
