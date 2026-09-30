import { execSync } from 'node:child_process';
import path from 'node:path';
import { PrismaPg } from '@prisma/adapter-pg';
import { seedReferenceData } from '../../prisma/reference-data.js';
import { PrismaClient } from '../generated/prisma/client.js';
import { assertTestDatabaseUrl } from './assert-test-database.js';

/**
 * Runs once before all test files (in the main Vitest process):
 * brings the test database schema up to date and loads reference data.
 */
export default async function setup(): Promise<void> {
  const databaseUrl = process.env.VITEST_DATABASE_URL ?? '';
  assertTestDatabaseUrl(databaseUrl);

  execSync('npx prisma migrate deploy', {
    cwd: path.resolve(import.meta.dirname, '../..'),
    env: { ...process.env, DATABASE_URL: databaseUrl },
    stdio: 'pipe',
  });

  const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: databaseUrl }) });
  try {
    await seedReferenceData(prisma);
  } finally {
    await prisma.$disconnect();
  }
}
