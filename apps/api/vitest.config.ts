import os from 'node:os';
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
// Read by src/test/global-setup.ts, which runs in this (main) process.
process.env.VITEST_DATABASE_URL = testDatabaseUrl;

export default defineConfig({
  resolve: {
    // Use packages/shared TypeScript source, same as `tsx --conditions=development`.
    conditions: ['development'],
  },
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
    globalSetup: ['./src/test/global-setup.ts'],
    // All integration tests share ONE database. Running files in parallel would let
    // one file's resetDatabase() wipe another file's data mid-test.
    fileParallelism: false,
    env: {
      NODE_ENV: 'test',
      LOG_LEVEL: 'silent',
      DATABASE_URL: testDatabaseUrl,
      JWT_ACCESS_SECRET: 'test-secret-that-is-at-least-32-characters-long',
      // Cost 4 instead of 12: ~1 ms instead of ~250 ms per hash, same code path.
      BCRYPT_COST: '4',
      // Attachments go to a throw-away directory, never into the repo.
      UPLOAD_DIR: path.join(os.tmpdir(), 'income-expenses-test-uploads'),
    },
    coverage: {
      provider: 'v8',
      include: ['src/**/*.ts'],
      exclude: [
        'src/generated/**',
        'src/test/**',
        'src/**/*.test.ts',
        'src/server.ts',
        'src/types/**',
      ],
      reporter: ['text', 'html', 'lcov'],
      thresholds: { lines: 70, functions: 70, statements: 70, branches: 70 },
    },
  },
});
