import { Prisma } from '../../generated/prisma/client.js';
import type { Db } from '../../lib/db.js';
import { prisma } from '../../lib/prisma.js';

const attachmentSelect = {
  id: true,
  storageKey: true,
  originalName: true,
  mimeType: true,
  sizeBytes: true,
  uploadedAt: true,
} as const;

export type AttachmentRow = Prisma.AttachmentGetPayload<{ select: typeof attachmentSelect }>;

/** Ownership always goes through the parent transaction's user_id (engineering rule 2). */
export const attachmentsRepository = {
  /**
   * Locks the (not deleted) transaction row so two concurrent uploads cannot both
   * see "2 attachments" and end up with 4. Returns false if it is not the user's.
   */
  async lockActiveTransaction(userId: bigint, transactionId: bigint, db: Db): Promise<boolean> {
    const rows = await db.$queryRaw<{ transaction_id: bigint }[]>(Prisma.sql`
      SELECT transaction_id FROM transactions
      WHERE transaction_id = ${transactionId} AND user_id = ${userId} AND deleted_at IS NULL
      FOR UPDATE
    `);
    return rows.length > 0;
  },

  countForTransaction(transactionId: bigint, db: Db = prisma): Promise<number> {
    return db.attachment.count({ where: { transactionId } });
  },

  /** Fast pre-check before files are written (the locked re-check is authoritative). */
  async countForOwnedTransaction(userId: bigint, transactionId: bigint): Promise<number | null> {
    const transaction = await prisma.transaction.findFirst({
      where: { id: transactionId, userId, deletedAt: null },
      select: { _count: { select: { attachments: true } } },
    });
    return transaction ? transaction._count.attachments : null;
  },

  create(
    data: {
      transactionId: bigint;
      storageKey: string;
      originalName: string;
      mimeType: string;
      sizeBytes: number;
    },
    db: Db,
  ) {
    return db.attachment.create({ data, select: attachmentSelect });
  },

  /** Attachments of a soft-deleted transaction stay readable (the trash can show them). */
  findOwned(userId: bigint, attachmentId: bigint, db: Db = prisma) {
    return db.attachment.findFirst({
      where: { id: attachmentId, transaction: { userId } },
      select: attachmentSelect,
    });
  },

  async delete(userId: bigint, attachmentId: bigint, db: Db = prisma): Promise<boolean> {
    const { count } = await db.attachment.deleteMany({
      where: { id: attachmentId, transaction: { userId } },
    });
    return count > 0;
  },
};

export type AttachmentsRepository = typeof attachmentsRepository;
