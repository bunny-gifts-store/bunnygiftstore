import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import fs from 'node:fs';
import path from 'node:path';

/**
 * Stamps the build timestamp into the service worker that Vite copies from
 * `public/` to the build output. Every deployment therefore ships a
 * byte-different `sw.js`, which is what makes browsers reliably detect an
 * update — and it names a fresh shell cache so stale HTML can't survive a
 * release.
 */
function stampServiceWorker() {
  let outDir;
  return {
    name: 'stamp-service-worker',
    apply: 'build',
    configResolved(config) {
      outDir = path.resolve(config.root, config.build.outDir);
    },
    closeBundle() {
      const file = path.join(outDir, 'sw.js');
      if (!fs.existsSync(file)) return;
      const build = new Date().toISOString().replace(/[^0-9]/g, '').slice(0, 14);
      const source = fs.readFileSync(file, 'utf8').replace(/__SW_BUILD__/g, build);
      fs.writeFileSync(file, source);
      // eslint-disable-next-line no-console
      console.log(`\nservice worker stamped: sw.js build ${build}`);
    },
  };
}

// The React SPA replaces the legacy static storefront. During development the
// API and uploaded images are proxied to the Express server on :5000.
export default defineConfig({
  plugins: [react(), stampServiceWorker()],
  server: {
    port: 5173,
    proxy: {
      '/api': 'http://localhost:5000',
      '/uploads': 'http://localhost:5000',
    },
  },
  build: {
    outDir: 'dist',
  },
});
