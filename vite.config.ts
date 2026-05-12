import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { buildApiApp } from './server/api-mount';

const __dirname = dirname(fileURLToPath(import.meta.url));

function superclockApi(): Plugin {
  return {
    name: 'superclock-api',
    configureServer(server) {
      const apiApp = buildApiApp({
        publicRoot: join(__dirname, 'public'),
        adminHost: true, // always on in dev so /admin can talk to /api/admin/*
      });
      // Express app is connect-compatible — falls through via next() for
      // unmatched paths so Vite's HTML/SPA handler keeps working.
      server.middlewares.use(apiApp);

      // Map /admin and /admin/<route> (no file extension) → /admin/index.html
      // so React Router can take over client-side routing in dev.
      server.middlewares.use((req, _res, next) => {
        if (req.url && /^\/admin(\/|$)/.test(req.url) && !/\.\w+(\?|$)/.test(req.url)) {
          req.url = '/admin/index.html';
        }
        next();
      });
    },
  };
}

export default defineConfig({
  plugins: [react(), tailwindcss(), superclockApi()],
  build: {
    target: 'es2020',
    rollupOptions: {
      input: {
        kiosk: join(__dirname, 'index.html'),
        admin: join(__dirname, 'admin/index.html'),
      },
    },
  },
});
