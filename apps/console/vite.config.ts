import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// The developer console inspects the LifeOS platform via its read-only /v1/console API.
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5174,
    proxy: {
      '/v1': { target: 'http://localhost:3000', changeOrigin: true },
    },
  },
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
});
