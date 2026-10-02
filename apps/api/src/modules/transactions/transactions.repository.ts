import type { Prisma } from '../../generated/prisma/client.js';
import type { Db } from '../../lib/db.js';
import { prisma } from '../../lib/prisma.js';

const walletRef = { select: { id: true, name: true, currencyCode: true } } as const;

/** Everything the list view needs, fetched in one query (no N+1). */
export const transactionInclude = {
  wallet: walletRef,
  toWallet: walletRef,
  category: {
    select: { id: true, name: true, systemKey: true, icon: true, color: true, parentId: true },
  },
  tags: {
    select: { tag: { select: { id: true, name: true } } },
    orderBy: { tag: { name: 'asc' } },
  },
  _count: { select: { attachments: true } },
} satisfies Prisma.TransactionInclude;

export const transactionDetailInclude = {
  ...transactionInclude,
  attachments: {
    select: { id: true, originalName: true, mimeType: true, sizeBytes: true, uploadedAt: true },
    orderBy: { uploadedAt: 'asc' },
  },
} satisfies Prisma.TransactionInclude;

/** Flat view for the CSV export (parent category name, tag names). */
export const transactionExportInclude = {
  wallet: { select: { name: true, currencyCode: true } },
  toWallet: { select: { name: true, currencyCode: true } },
  category: {
    select: { name: true, systemKey: true, parent: { select: { name: true, systemKey: true } } },
  },
  tags: { select: { tag: { select: { name: true } } }, orderBy: { tag: { name: 'asc' } } },
} satisfies Prisma.TransactionInclude;

export type TransactionExportRow = Prisma.TransactionGetPayload<{
  include: typeof transactionExportInclude;
}>;

export type TransactionRow = Prisma.TransactionGetPayload<{ include: typeof transactionInclude }>;
export type TransactionDetailRow = Prisma.TransactionGetPayload<{
  include: typeof transactionDetailInclude;
}>;

/** Columns written by create/update (ownership fields are passed separately). */
export interface TransactionWriteData {
  type: string;
  walletId: bigint;
  toWalletId: bigint | null;
  categoryId: bigint | null;
  amount: Prisma.Decimal;
  toAmount: Prisma.Decimal | null;
  note: string | null;
  occurredAt: Date;
}

export const transactionsRepository = {
  /** Page + total in one DB transaction so both see the same snapshot. */
  async findPage(
    where: Prisma.TransactionWhereInput,
    orderBy: Prisma.TransactionOrderByWithRelationInput[],
    skip: number,
    take: number,
  ): Promise<{ rows: TransactionRow[]; total: number }> {
    const [rows, total] = await prisma.$transaction([
      prisma.transaction.findMany({ where, orderBy, skip, take, include: transactionInclude }),
      prisma.transaction.count({ where }),
    ]);
    return { rows, total };
  },

  /**
   * Yields matching rows in batches using cursor pagination: a 50 000-row export never sits
   * in memory at once, and never pays for a slow OFFSET.
   */
  async *streamForExport(
    where: Prisma.TransactionWhereInput,
    orderBy: Prisma.TransactionOrderByWithRelationInput[],
    batchSize = 1000,
  ): AsyncGenerator<TransactionExportRow[]> {
    let cursor: bigint | undefined;
    for (;;) {
      const rows = await prisma.transaction.findMany({
        where,
        orderBy,
        include: transactionExportInclude,
        take: batchSize,
        ...(cursor === undefined ? {} : { skip: 1, cursor: { id: cursor } }),
      });
      if (rows.length === 0) return;
      yield rows;
      if (rows.length < batchSize) return;
      cursor = rows[rows.length - 1]?.id;
    }
  },

  findActiveById(userId: bigint, id: bigint, db: Db = prisma) {
    return db.transaction.findFirst({
      where: { id, userId, deletedAt: null },
      include: transactionDetailInclude,
    });
  },

  findDeletedById(userId: bigint, id: bigint, db: Db = prisma) {
    return db.transaction.findFirst({
      where: { id, userId, deletedAt: { not: null } },
      select: { id: true, walletId: true, toWalletId: true },
    });
  },

  async create(
    userId: bigint,
    data: TransactionWriteData,
    tagIds: bigint[],
    db: Db = prisma,
  ): Promise<bigint> {
    const created = await db.transaction.create({
      data: { ...data, userId, tags: { create: tagIds.map((tagId) => ({ tagId })) } },
      select: { id: true },
    });
    return created.id;
  },

  /**
   * `where` includes userId and deletedAt so a stale id can never touch another
   * user's row; a miss throws P2025 → 404 in the central error handler.
   * `tagIds` undefined = leave tags as they are; an array = replace them all.
   */
  async update(
    userId: bigint,
    id: bigint,
    data: TransactionWriteData,
    tagIds: bigint[] | undefined,
    db: Db = prisma,
  ): Promise<void> {
    await db.transaction.update({
      where: { id, userId, deletedAt: null },
      data: {
        ...data,
        ...(tagIds ? { tags: { deleteMany: {}, create: tagIds.map((tagId) => ({ tagId })) } } : {}),
      },
    });
  },

  async softDelete(userId: bigint, id: bigint, db: Db = prisma): Promise<boolean> {
    const { count } = await db.transaction.updateMany({
      where: { id, userId, deletedAt: null },
      data: { deletedAt: new Date() },
    });
    return count > 0;
  },

  async restore(userId: bigint, id: bigint, db: Db = prisma): Promise<boolean> {
    const { count } = await db.transaction.updateMany({
      where: { id, userId, deletedAt: { not: null } },
      data: { deletedAt: null },
    });
    return count > 0;
  },
};

export type TransactionsRepository = typeof transactionsRepository;
