import { config } from '../config/index.js';
import { prisma } from '../lib/prisma.js';
import { assertTestDatabaseUrl } from './assert-test-database.js';

/**
 * Removes every user and — through ON DELETE CASCADE — all of their data.
 * Reference data (currencies, system categories) is kept.
 * Call in `beforeAll` of every integration test file.
 */
export async function resetDatabase(): Promise<void> {
  assertTestDatabaseUrl(config.DATABASE_URL);
  await prisma.user.deleteMany();
}
