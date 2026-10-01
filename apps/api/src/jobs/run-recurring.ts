/**
 * Runs the recurring job once, outside the schedule — e.g. after downtime, or to test.
 *   dev:        npm run job:recurring -w apps/api
 *   production: docker compose exec api node dist/jobs/run-recurring.js
 * Safe to run while the API is up: rows are locked, so nothing is created twice.
 */
import { logger } from '../lib/logger.js';
import { prisma } from '../lib/prisma.js';
import { runRecurringJob } from './recurring.job.js';

try {
  const result = await runRecurringJob();
  process.exitCode = result.failed > 0 ? 1 : 0;
} catch (error) {
  logger.error({ err: error }, 'Recurring job failed');
  process.exitCode = 1;
} finally {
  await prisma.$disconnect();
  logger.flush();
}
