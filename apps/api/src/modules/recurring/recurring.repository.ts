import { Prisma } from '../../generated/prisma/client.js';
import type { Db } from '../../lib/db.js';
import { prisma } from '../../lib/prisma.js';

const recurringSelect = {
  id: true,
  type: true,
  amount: true,
  note: true,
  frequency: true,
  nextRunDate: true,
  endDate: true,
  isActive: true,
  walletId: true,
  categoryId: true,
  wallet: { select: { id: true, name: true, currencyCode: true } },
  category: {
    select: { id: true, name: true, systemKey: true, icon: true, color: true, parentId: true },
  },
} as const;

export type RecurringRow = Prisma.RecurringTransactionGetPayload<{
  select: typeof recurringSelect;
}>;

export interface RecurringWriteData {
  type: string;
  walletId: bigint;
  categoryId: bigint;
  amount: Prisma.Decimal;
  note: string | null;
  frequency: string;
  nextRunDate: Date;
  endDate: Date | null;
  isActive: boolean;
}

/** A due recurring, locked by the job (see lockDue). Dates are "YYYY-MM-DD" strings. */
export interface LockedRecurring {
  id: bigint;
  userId: bigint;
  type: string;
  walletId: bigint;
  categoryId: bigint;
  amount: string;
  note: string | null;
  frequency: string;
  nextRunDate: string;
  endDate: string | null;
  timezone: string;
  walletArchived: boolean;
}

interface LockedRow {
  recurring_id: bigint;
  user_id: bigint;
  type: string;
  wallet_id: bigint;
  category_id: bigint;
  amount: string;
  note: string | null;
  frequency: string;
  next_run_date: string;
  end_date: string | null;
  timezone: string;
  wallet_archived: boolean;
}

/** Every CRUD query is scoped by user_id (engineering rule 2). */
export const recurringRepository = {
  findAll(userId: bigint, db: Db = prisma) {
    return db.recurringTransaction.findMany({
      where: { userId },
      select: recurringSelect,
      // Active first, then the soonest run.
      orderBy: [{ isActive: 'desc' }, { nextRunDate: 'asc' }, { id: 'asc' }],
    });
  },

  findById(userId: bigint, recurringId: bigint, db: Db = prisma) {
    return db.recurringTransaction.findFirst({
      where: { id: recurringId, userId },
      select: recurringSelect,
    });
  },

  async create(userId: bigint, data: RecurringWriteData, db: Db = prisma): Promise<bigint> {
    const { id } = await db.recurringTransaction.create({
      data: { userId, ...data },
      select: { id: true },
    });
    return id;
  },

  async update(
    userId: bigint,
    recurringId: bigint,
    data: RecurringWriteData,
    db: Db = prisma,
  ): Promise<boolean> {
    const { count } = await db.recurringTransaction.updateMany({
      where: { id: recurringId, userId },
      data,
    });
    return count > 0;
  },

  /** Generated transactions stay; their recurring_id becomes NULL (ON DELETE SET NULL). */
  async delete(userId: bigint, recurringId: bigint, db: Db = prisma): Promise<boolean> {
    const { count } = await db.recurringTransaction.deleteMany({
      where: { id: recurringId, userId },
    });
    return count > 0;
  },

  // ---------------------------------------------------------------------------
  // Job queries — these run for ALL users on purpose (system job, not a request).
  // ---------------------------------------------------------------------------

  /**
   * Ids of active recurring whose next run is today or earlier in the OWNER's
   * timezone. `now AT TIME ZONE tz` turns the instant into the owner's wall clock.
   * The comparison keeps next_run_date bare so idx_recurring_due (WHERE is_active) applies.
   */
  async findDueIds(now: Date, db: Db = prisma): Promise<bigint[]> {
    const rows = await db.$queryRaw<{ recurring_id: bigint }[]>(Prisma.sql`
      SELECT r.recurring_id
      FROM recurring_transactions r
      JOIN users u ON u.user_id = r.user_id
      WHERE r.is_active
        AND r.next_run_date <= (${now}::timestamptz AT TIME ZONE u.timezone)::date
      ORDER BY r.recurring_id
    `);
    return rows.map((row) => row.recurring_id);
  },

  /**
   * Locks one recurring row until the surrounding transaction ends.
   * SKIP LOCKED: if another instance of the job holds it, return nothing instead of
   * waiting — that instance is already processing it (design-doc D8).
   * `is_active` is re-checked here because the row may have changed since findDueIds.
   */
  async lockDue(recurringId: bigint, db: Db): Promise<LockedRecurring | null> {
    const [row] = await db.$queryRaw<LockedRow[]>(Prisma.sql`
      SELECT r.recurring_id, r.user_id, r.type, r.wallet_id, r.category_id,
             r.amount::text AS amount, r.note, r.frequency,
             to_char(r.next_run_date, 'YYYY-MM-DD') AS next_run_date,
             to_char(r.end_date, 'YYYY-MM-DD') AS end_date,
             u.timezone, w.is_archived AS wallet_archived
      FROM recurring_transactions r
      JOIN users u ON u.user_id = r.user_id
      JOIN wallets w ON w.wallet_id = r.wallet_id
      WHERE r.recurring_id = ${recurringId} AND r.is_active
      FOR UPDATE OF r SKIP LOCKED
    `);
    if (!row) {
      return null;
    }
    return {
      id: row.recurring_id,
      userId: row.user_id,
      type: row.type,
      walletId: row.wallet_id,
      categoryId: row.category_id,
      amount: row.amount,
      note: row.note,
      frequency: row.frequency,
      nextRunDate: row.next_run_date,
      endDate: row.end_date,
      timezone: row.timezone,
      walletArchived: row.wallet_archived,
    };
  },

  async createGeneratedTransactions(
    data: Prisma.TransactionCreateManyInput[],
    db: Db,
  ): Promise<number> {
    if (data.length === 0) {
      return 0;
    }
    const { count } = await db.transaction.createMany({ data });
    return count;
  },

  async advance(recurringId: bigint, nextRunDate: Date, isActive: boolean, db: Db): Promise<void> {
    await db.recurringTransaction.update({
      where: { id: recurringId },
      data: { nextRunDate, isActive },
    });
  },

  async deleteExpiredRefreshTokens(now: Date, db: Db = prisma): Promise<number> {
    const { count } = await db.refreshToken.deleteMany({ where: { expiresAt: { lt: now } } });
    return count;
  },
};

export type RecurringRepository = typeof recurringRepository;
