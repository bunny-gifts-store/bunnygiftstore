import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// The React SPA replaces the legacy static storefront. During development the
// API and uploaded images are proxied to the Express server on :5000.
export default defineConfig({
  plugins: [react()],
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
