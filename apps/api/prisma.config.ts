import path from 'node:path';
import { config as loadEnv } from 'dotenv';
import { defineConfig } from 'prisma/config';

// Prisma 7 no longer loads .env automatically. On a developer machine the single
// source of truth is the repo-root .env; inside Docker/CI the variables are injected
// by the environment and this file simply does not exist (dotenv ignores that).
loadEnv({ path: path.resolve(import.meta.dirname, '../../.env'), quiet: true });

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations',
    seed: 'tsx prisma/seed.ts',
  },
  datasource: {
    // `prisma generate` does not need a database, so do not fail when it is unset.
    url: process.env.DATABASE_URL ?? '',
  },
});
