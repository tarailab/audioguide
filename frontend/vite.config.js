import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// NOTE: vite-plugin-pwa intentionally removed — its service worker cached the
// app and served stale bundles across reloads, which made iteration impossible.
// Reinstate only for a production build, never for the dev server.

export default defineConfig({
  plugins: [react()],
  server: {
    host: '0.0.0.0',
    port: 5173,
    // Windows + Docker bind mounts don't deliver native file-change events to
    // the container, so Vite never sees edits and serves stale transforms.
    // Polling fixes it — edits now hot-reload without a container restart.
    watch: { usePolling: true, interval: 300 },
    allowedHosts: ['tarailab.tail1868ac.ts.net', 'localhost'],
    proxy: {
      '/api': 'http://backend:3001',
      '/health': 'http://backend:3001',
    },
  },
});
