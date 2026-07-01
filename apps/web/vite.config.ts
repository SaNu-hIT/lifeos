import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// The web app talks to the LifeOS API (phase 28 standard, phase 29 SSE). In dev, /v1
// is proxied to the local API so cookies/CORS stay simple.
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/v1': { target: 'http://localhost:3000', changeOrigin: true },
    },
  },
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
});
