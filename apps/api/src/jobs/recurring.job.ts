import type { RecurringFrequency } from '@income-expenses/shared';
import type { Prisma } from '../generated/prisma/client.js';
import { runInTransaction, type TransactionRunner } from '../lib/db.js';
import { logger as rootLogger } from '../lib/logger.js';
import { toDecimal } from '../lib/money.js';
import { nextOccurrence, todayIn, toDateColumn } from '../lib/recurrence.js';
import { startOfLocalDay } from '../lib/time.js';
import {
  type LockedRecurring,
  type RecurringRepository,
  recurringRepository,
} from '../modules/recurring/recurring.repository.js';

/**
 * Upper bound of transactions ONE recurring may create in one run. A daily recurring
 * after a year of downtime would otherwise insert hundreds of rows in one transaction;
 * the rest is created by the following runs (next_run_date still points at them).
 */
export const MAX_RUNS_PER_RECURRING = 366;

export interface RecurringJobResult {
  due: number;
  processed: number;
  /** Locked by another instance, or already processed (next_run_date moved on). */
  skipped: number;
  failed: number;
  transactionsCreated: number;
  deactivated: number;
  refreshTokensDeleted: number;
}

interface RecurringJobDeps {
  recurring: RecurringRepository;
  transaction: TransactionRunner;
  logger: Pick<typeof rootLogger, 'info' | 'warn' | 'error'>;
}

type Outcome = { kind: 'skipped' } | { kind: 'processed'; created: number; deactivated: boolean };

/** The dates to create and where next_run_date goes afterwards. Pure — easy to reason about. */
export function planRuns(
  item: Pick<LockedRecurring, 'nextRunDate' | 'endDate'> & { frequency: RecurringFrequency },
  today: string,
): { dates: string[]; nextRunDate: string; isActive: boolean } {
  const dates: string[] = [];
  let next = item.nextRunDate;
  while (
    next <= today &&
    (item.endDate === null || next <= item.endDate) &&
    dates.length < MAX_RUNS_PER_RECURRING
  ) {
    dates.push(next);
    next = nextOccurrence(next, item.frequency);
  }
  // Past end_date → finished. next_run_date may now be AFTER end_date, which is why
  // the DB has no CHECK (end_date >= next_run_date) — design-doc X9.
  const isActive = item.endDate === null || next <= item.endDate;
  return { dates, nextRunDate: next, isActive };
}

export function createRecurringJob({ recurring, transaction, logger }: RecurringJobDeps) {
  /**
   * One recurring = one DB transaction: lock → insert the transactions → move
   * next_run_date → COMMIT. A crash rolls back both, so a re-run neither skips nor
   * duplicates (idempotent). Two instances running at once: the second one gets
   * nothing from SKIP LOCKED, and after the first commits the row is no longer due.
   */
  async function processOne(recurringId: bigint, now: Date): Promise<Outcome> {
    return transaction(async (tx) => {
      const item = await recurring.lockDue(recurringId, tx);
      if (!item) {
        return { kind: 'skipped' };
      }
      const today = todayIn(item.timezone, now);
      if (item.nextRunDate > today) {
        return { kind: 'skipped' };
      }

      if (item.walletArchived) {
        // Archived wallets accept no new entries (business rule 4) — pause instead of failing daily.
        await recurring.advance(item.id, toDateColumn(item.nextRunDate), false, tx);
        logger.warn(
          { recurringId: item.id.toString(), walletId: item.walletId.toString() },
          'Recurring deactivated: wallet is archived',
        );
        return { kind: 'processed', created: 0, deactivated: true };
      }

      const plan = planRuns({ ...item, frequency: item.frequency as RecurringFrequency }, today);
      const amount = toDecimal(item.amount);
      const rows: Prisma.TransactionCreateManyInput[] = plan.dates.map((date) => ({
        userId: item.userId,
        type: item.type,
        walletId: item.walletId,
        categoryId: item.categoryId,
        amount,
        note: item.note,
        // 00:00 of the run date in the owner's timezone (docs/api.md §12).
        occurredAt: startOfLocalDay(date, item.timezone),
        recurringId: item.id,
      }));
      const created = await recurring.createGeneratedTransactions(rows, tx);
      await recurring.advance(item.id, toDateColumn(plan.nextRunDate), plan.isActive, tx);

      if (plan.dates.length === MAX_RUNS_PER_RECURRING && plan.nextRunDate <= today) {
        logger.warn(
          { recurringId: item.id.toString(), nextRunDate: plan.nextRunDate },
          'Recurring catch-up capped; the rest is created by the next run',
        );
      }
      return { kind: 'processed', created, deactivated: !plan.isActive };
    });
  }

  return async function runRecurringJob(now = new Date()): Promise<RecurringJobResult> {
    const startedAt = Date.now();
    const ids = await recurring.findDueIds(now);
    const result: RecurringJobResult = {
      due: ids.length,
      processed: 0,
      skipped: 0,
      failed: 0,
      transactionsCreated: 0,
      deactivated: 0,
      refreshTokensDeleted: 0,
    };

    for (const id of ids) {
      try {
        const outcome = await processOne(id, now);
        if (outcome.kind === 'skipped') {
          result.skipped += 1;
        } else {
          result.processed += 1;
          result.transactionsCreated += outcome.created;
          result.deactivated += outcome.deactivated ? 1 : 0;
        }
      } catch (error) {
        // One broken row must not block everyone else's recurring entries.
        result.failed += 1;
        logger.error({ err: error, recurringId: id.toString() }, 'Recurring run failed');
      }
    }

    // Housekeeping: expired refresh tokens are useless — keep the table small.
    result.refreshTokensDeleted = await recurring.deleteExpiredRefreshTokens(now);

    logger.info({ ...result, durationMs: Date.now() - startedAt }, 'Recurring job finished');
    return result;
  };
}

export const runRecurringJob = createRecurringJob({
  recurring: recurringRepository,
  transaction: runInTransaction,
  logger: rootLogger,
});
