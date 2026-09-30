/**
 * Reference data for EVERY environment (production included): currencies and system
 * categories. Idempotent, so the deploy runs it after every `prisma migrate deploy`.
 * Without it a fresh production database has no currencies and nobody can register.
 *
 * Demo users are NOT created here — that is `prisma/seed.ts` (development/staging only).
 */
import path from 'node:path';
import { PrismaPg } from '@prisma/adapter-pg';
import { config as loadEnv } from 'dotenv';
import { PrismaClient } from '../src/generated/prisma/client.js';
import { seedReferenceData } from './reference-data.js';

loadEnv({ path: path.resolve(import.meta.dirname, '../../../.env'), quiet: true });

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  throw new Error('DATABASE_URL is not set');
}

const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: databaseUrl }) });

try {
  const categories = await seedReferenceData(prisma);
  // eslint-disable-next-line no-console -- CLI script output
  console.log(
    `Reference data OK: currencies + ${Object.keys(categories).length} system categories`,
  );
} finally {
  await prisma.$disconnect();
}
