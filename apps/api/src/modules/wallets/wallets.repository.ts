import { Prisma } from '../../generated/prisma/client.js';
import type { Db } from '../../lib/db.js';
import { prisma } from '../../lib/prisma.js';

/** A wallet row joined with its derived balance from v_wallet_balances. */
export interface WalletWithBalance {
  id: bigint;
  name: string;
  type: string;
  currencyCode: string;
  initialBalance: Prisma.Decimal;
  balance: Prisma.Decimal;
  isArchived: boolean;
  createdAt: Date;
}

interface WalletBalanceRow {
  wallet_id: bigint;
  name: string;
  type: string;
  currency_code: string;
  initial_balance: Prisma.Decimal;
  balance: Prisma.Decimal;
  is_archived: boolean;
  created_at: Date;
}

function toWalletWithBalance(row: WalletBalanceRow): WalletWithBalance {
  return {
    id: row.wallet_id,
    name: row.name,
    type: row.type,
    currencyCode: row.currency_code,
    initialBalance: new Prisma.Decimal(row.initial_balance),
    balance: new Prisma.Decimal(row.balance),
    isArchived: row.is_archived,
    createdAt: row.created_at,
  };
}

/** Every query is scoped by user_id (engineering rule 2). */
export const walletsRepository = {
  async findManyWithBalance(
    userId: bigint,
    options: { includeArchived: boolean; walletId?: bigint },
    db: Db = prisma,
  ): Promise<WalletWithBalance[]> {
    const walletFilter = options.walletId
      ? Prisma.sql`AND w.wallet_id = ${options.walletId}`
      : Prisma.empty;
    const rows = await db.$queryRaw<WalletBalanceRow[]>`
      SELECT w.wallet_id, w.name, w.type, w.currency_code, w.initial_balance,
             b.balance, w.is_archived, w.created_at
      FROM wallets w
      JOIN v_wallet_balances b ON b.wallet_id = w.wallet_id
      WHERE w.user_id = ${userId}
        AND (${options.includeArchived} OR NOT w.is_archived)
        ${walletFilter}
      ORDER BY w.created_at, w.wallet_id`;
    return rows.map(toWalletWithBalance);
  },

  async findOneWithBalance(
    userId: bigint,
    walletId: bigint,
    db: Db = prisma,
  ): Promise<WalletWithBalance | null> {
    const [wallet] = await walletsRepository.findManyWithBalance(
      userId,
      { includeArchived: true, walletId },
      db,
    );
    return wallet ?? null;
  },

  /** Lightweight lookup used to validate the wallets referenced by a transaction. */
  findManyByIds(userId: bigint, ids: bigint[], db: Db = prisma) {
    return db.wallet.findMany({
      where: { userId, id: { in: ids } },
      select: { id: true, name: true, currencyCode: true, isArchived: true },
    });
  },

  findByName(userId: bigint, name: string, db: Db = prisma) {
    return db.wallet.findFirst({ where: { userId, name }, select: { id: true } });
  },

  async create(
    data: {
      userId: bigint;
      name: string;
      type: string;
      currencyCode: string;
      initialBalance: Prisma.Decimal;
    },
    db: Db = prisma,
  ): Promise<bigint> {
    const wallet = await db.wallet.create({ data, select: { id: true } });
    return wallet.id;
  },

  /** Returns false when the wallet does not exist OR belongs to someone else. */
  async update(
    userId: bigint,
    walletId: bigint,
    data: {
      name?: string | undefined;
      type?: string | undefined;
      isArchived?: boolean | undefined;
    },
    db: Db = prisma,
  ): Promise<boolean> {
    const { count } = await db.wallet.updateMany({ where: { id: walletId, userId }, data });
    return count > 0;
  },

  async delete(userId: bigint, walletId: bigint, db: Db = prisma): Promise<boolean> {
    const { count } = await db.wallet.deleteMany({ where: { id: walletId, userId } });
    return count > 0;
  },

  /** Counts soft-deleted transactions too: their FK still points at the wallet (design-doc D9). */
  async isInUse(walletId: bigint, db: Db = prisma): Promise<boolean> {
    const [transactions, recurring] = await Promise.all([
      db.transaction.count({ where: { OR: [{ walletId }, { toWalletId: walletId }] } }),
      db.recurringTransaction.count({ where: { walletId } }),
    ]);
    return transactions + recurring > 0;
  },
};

export type WalletsRepository = typeof walletsRepository;
