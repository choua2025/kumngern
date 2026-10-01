import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { createApp } from '../app.js';
import { prisma } from '../lib/prisma.js';
import { toDateColumn } from '../lib/recurrence.js';
import { registerUser } from '../test/auth-helpers.js';
import { resetDatabase } from '../test/db.js';
import { apiClient, createWallet, systemCategoryId } from '../test/fixtures.js';
import { MAX_RUNS_PER_RECURRING, planRuns, runRecurringJob } from './recurring.job.js';

const app = createApp();
let userId: bigint;
let walletId: bigint;
let food: bigint;

/** 2026-10-05 01:00 in Bangkok (UTC+7) = 2026-10-04 18:00 UTC. */
const NOW = new Date('2026-10-04T18:00:00Z');

interface RecurringSeed {
  frequency?: string;
  nextRunDate: string;
  endDate?: string | null;
  walletId?: bigint;
  userId?: bigint;
}

/** Inserted directly: the API refuses past start dates, but the job must catch up on them. */
async function seedRecurring(seed: RecurringSeed): Promise<bigint> {
  const { id } = await prisma.recurringTransaction.create({
    data: {
      userId: seed.userId ?? userId,
      type: 'expense',
      walletId: seed.walletId ?? walletId,
      categoryId: food,
      amount: '100.25',
      note: 'ค่าเน็ต',
      frequency: seed.frequency ?? 'daily',
      nextRunDate: toDateColumn(seed.nextRunDate),
      endDate: seed.endDate ? toDateColumn(seed.endDate) : null,
    },
    select: { id: true },
  });
  return id;
}

async function generated(recurringId: bigint) {
  return prisma.transaction.findMany({
    where: { recurringId },
    orderBy: { occurredAt: 'asc' },
    select: { occurredAt: true, amount: true, note: true, type: true, categoryId: true },
  });
}

async function state(recurringId: bigint) {
  const row = await prisma.recurringTransaction.findUniqueOrThrow({ where: { id: recurringId } });
  return { nextRunDate: row.nextRunDate.toISOString().slice(0, 10), isActive: row.isActive };
}

beforeAll(async () => {
  await resetDatabase();
  const user = await registerUser(app);
  userId = BigInt(user.user.id);
  walletId = BigInt((await createWallet(apiClient(app, user.accessToken))).id);
  food = BigInt(await systemCategoryId('อาหาร', 'expense'));
});

beforeEach(async () => {
  await prisma.transaction.deleteMany({ where: { recurringId: { not: null } } });
  await prisma.recurringTransaction.deleteMany();
});

afterAll(async () => {
  await prisma.$disconnect();
});

describe('planRuns (pure)', () => {
  it('stops at today, at end_date, and at the cap', () => {
    expect(
      planRuns({ nextRunDate: '2026-10-01', endDate: null, frequency: 'daily' }, '2026-10-03'),
    ).toEqual({
      dates: ['2026-10-01', '2026-10-02', '2026-10-03'],
      nextRunDate: '2026-10-04',
      isActive: true,
    });
    expect(
      planRuns(
        { nextRunDate: '2026-10-01', endDate: '2026-10-02', frequency: 'daily' },
        '2026-10-09',
      ),
    ).toEqual({ dates: ['2026-10-01', '2026-10-02'], nextRunDate: '2026-10-03', isActive: false });
    expect(
      planRuns({ nextRunDate: '2020-01-01', endDate: null, frequency: 'daily' }, '2026-10-01')
        .dates,
    ).toHaveLength(MAX_RUNS_PER_RECURRING);
  });
});

describe('runRecurringJob', () => {
  it('creates the due transaction at 00:00 in the owner timezone and moves next_run_date', async () => {
    const id = await seedRecurring({ frequency: 'monthly', nextRunDate: '2026-10-05' });

    const result = await runRecurringJob(NOW);

    expect(result).toMatchObject({ due: 1, processed: 1, transactionsCreated: 1, failed: 0 });
    const rows = await generated(id);
    expect(rows).toHaveLength(1);
    // 2026-10-05 00:00 Asia/Bangkok
    expect(rows[0]?.occurredAt.toISOString()).toBe('2026-10-04T17:00:00.000Z');
    expect(rows[0]).toMatchObject({ note: 'ค่าเน็ต', type: 'expense', categoryId: food });
    expect(rows[0]?.amount.toString()).toBe('100.25');
    expect(await state(id)).toEqual({ nextRunDate: '2026-11-05', isActive: true });
  });

  it('is idempotent: running twice creates nothing new', async () => {
    const id = await seedRecurring({ nextRunDate: '2026-10-05' });

    await runRecurringJob(NOW);
    const second = await runRecurringJob(NOW);

    expect(second.due).toBe(0);
    expect(await generated(id)).toHaveLength(1);
  });

  it('never duplicates when two instances run at the same time', async () => {
    const ids = await Promise.all(
      Array.from({ length: 5 }, () => seedRecurring({ nextRunDate: '2026-10-03' })),
    );

    const results = await Promise.all([runRecurringJob(NOW), runRecurringJob(NOW)]);

    expect(results.reduce((sum, r) => sum + r.transactionsCreated, 0)).toBe(15);
    for (const id of ids) {
      expect(await generated(id)).toHaveLength(3); // 3rd, 4th, 5th
    }
  });

  it('skips a row that another instance has locked (SKIP LOCKED), then processes it later', async () => {
    const id = await seedRecurring({ nextRunDate: '2026-10-05' });

    // Hold the row lock in another transaction while the job runs.
    await prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT 1 FROM recurring_transactions WHERE recurring_id = ${id} FOR UPDATE`;
      const blocked = await runRecurringJob(NOW);
      expect(blocked).toMatchObject({ due: 1, skipped: 1, transactionsCreated: 0 });
    });

    const later = await runRecurringJob(NOW);
    expect(later).toMatchObject({ processed: 1, transactionsCreated: 1 });
    expect(await generated(id)).toHaveLength(1);
  });

  it('catches up every missed run after downtime', async () => {
    const id = await seedRecurring({ frequency: 'weekly', nextRunDate: '2026-09-14' });

    const result = await runRecurringJob(NOW);

    expect(result.transactionsCreated).toBe(4); // 14, 21, 28 Sep + 5 Oct
    expect(await state(id)).toEqual({ nextRunDate: '2026-10-12', isActive: true });
  });

  it('deactivates after the last run on end_date', async () => {
    const id = await seedRecurring({ nextRunDate: '2026-10-03', endDate: '2026-10-04' });

    const result = await runRecurringJob(NOW);

    expect(result).toMatchObject({ transactionsCreated: 2, deactivated: 1 });
    expect(await state(id)).toEqual({ nextRunDate: '2026-10-05', isActive: false });
    expect((await runRecurringJob(NOW)).due).toBe(0);
  });

  it('uses the owner timezone for "today"', async () => {
    const id = await seedRecurring({ nextRunDate: '2026-10-05' });
    // NOW is still 2026-10-04 in New York → not due yet for that user.
    await prisma.user.update({ where: { id: userId }, data: { timezone: 'America/New_York' } });
    try {
      expect((await runRecurringJob(NOW)).due).toBe(0);
      expect(await generated(id)).toHaveLength(0);
    } finally {
      await prisma.user.update({ where: { id: userId }, data: { timezone: 'Asia/Bangkok' } });
    }
  });

  it('deactivates a recurring whose wallet was archived instead of creating entries', async () => {
    const archived = await prisma.wallet.create({
      data: {
        userId,
        name: 'archived-wallet',
        type: 'cash',
        currencyCode: 'THB',
        isArchived: true,
      },
    });
    const id = await seedRecurring({ nextRunDate: '2026-10-05', walletId: archived.id });

    const result = await runRecurringJob(NOW);

    expect(result).toMatchObject({ processed: 1, transactionsCreated: 0, deactivated: 1 });
    expect(await state(id)).toEqual({ nextRunDate: '2026-10-05', isActive: false });
  });

  it('ignores inactive and future rows', async () => {
    const paused = await seedRecurring({ nextRunDate: '2026-10-01' });
    await prisma.recurringTransaction.update({ where: { id: paused }, data: { isActive: false } });
    await seedRecurring({ nextRunDate: '2026-10-06' });

    expect((await runRecurringJob(NOW)).due).toBe(0);
  });

  it('deletes expired refresh tokens', async () => {
    await prisma.refreshToken.create({
      data: { userId, tokenHash: 'e'.repeat(64), expiresAt: new Date('2026-10-01T00:00:00Z') },
    });

    const result = await runRecurringJob(NOW);

    expect(result.refreshTokensDeleted).toBeGreaterThanOrEqual(1);
    expect(await prisma.refreshToken.count({ where: { tokenHash: 'e'.repeat(64) } })).toBe(0);
  });
});
