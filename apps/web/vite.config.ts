import path from 'node:path';
import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { loadEnv } from 'vite';
import { defineConfig } from 'vitest/config';

export default defineConfig(({ mode }) => {
  // Read PORT from the repo-root .env so the dev proxy follows the API port.
  const rootEnv = loadEnv(mode, path.resolve(import.meta.dirname, '../..'), '');
  const apiTarget =
    process.env.VITE_API_PROXY_TARGET ?? `http://127.0.0.1:${rootEnv.PORT ?? '3000'}`;

  return {
    plugins: [react(), tailwindcss()],
    resolve: {
      // Use packages/shared TypeScript source directly (no build step in dev).
      conditions: ['development'],
    },
    server: {
      port: 5173,
      // Same-origin in development too: the browser only talks to Vite, which forwards
      // /api to Express. No CORS, and the refresh cookie (Path=/api/v1/auth) just works.
      proxy: {
        '/api': { target: apiTarget, changeOrigin: false },
      },
    },
    test: {
      environment: 'jsdom',
      setupFiles: ['./src/test/setup.ts'],
      include: ['src/**/*.test.{ts,tsx}'],
      css: false,
    },
  };
});
