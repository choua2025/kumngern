import path from 'node:path';
import { config as loadDotenv } from 'dotenv';
import { defineConfig } from 'vitest/config';

// Read the repo-root .env without touching process.env, then point the API at the
// TEST database. In CI, TEST_DATABASE_URL comes from the workflow environment.
const fileEnv: Record<string, string> = {};
loadDotenv({
  path: path.resolve(import.meta.dirname, '../../.env'),
  quiet: true,
  processEnv: fileEnv,
});

const testDatabaseUrl = process.env.TEST_DATABASE_URL ?? fileEnv.TEST_DATABASE_URL ?? '';

export default defineConfig({
  resolve: {
    // Use packages/shared TypeScript source, same as `tsx --conditions=development`.
    conditions: ['development'],
  },
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
    env: {
      NODE_ENV: 'test',
      LOG_LEVEL: 'silent',
      DATABASE_URL: testDatabaseUrl,
    },
  },
});
