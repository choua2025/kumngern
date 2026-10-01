import cron, { type ScheduledTask } from 'node-cron';
import { config } from '../config/index.js';
import { logger } from '../lib/logger.js';
import { runRecurringJob } from './recurring.job.js';

/** Every day at 00:05 in CRON_TZ — a few minutes after midnight, away from DST edges. */
export const RECURRING_SCHEDULE = '5 0 * * *';

export interface Scheduler {
  /** Stops future runs and waits for a run that is in progress (graceful shutdown). */
  stop(): Promise<void>;
}

/**
 * Starts the in-process cron (design-doc D8). Only server.ts calls this — tests and
 * one-off scripts import the job directly, so they never start a timer.
 */
export function startScheduler(): Scheduler {
  if (!config.CRON_ENABLED) {
    logger.info('Cron disabled (CRON_ENABLED=false)');
    return { stop: () => Promise.resolve() };
  }

  let running: Promise<unknown> | null = null;

  const task: ScheduledTask = cron.schedule(
    RECURRING_SCHEDULE,
    async () => {
      running = runRecurringJob().catch((error: unknown) => {
        logger.error({ err: error }, 'Recurring job crashed');
      });
      await running;
      running = null;
    },
    {
      name: 'recurring',
      timezone: config.CRON_TZ,
      // A slow run is never started twice in the same process (rows are also locked).
      noOverlap: true,
    },
  );

  logger.info(
    { schedule: RECURRING_SCHEDULE, timezone: config.CRON_TZ, nextRun: task.getNextRun() },
    'Cron scheduled',
  );

  return {
    async stop() {
      await task.stop();
      await task.destroy();
      if (running) {
        // The job commits per recurring; letting the current one finish avoids a rollback.
        await running;
      }
    },
  };
}
