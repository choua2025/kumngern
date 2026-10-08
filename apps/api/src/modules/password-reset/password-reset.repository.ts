import { Prisma } from '../../generated/prisma/client.js';
import type { Db } from '../../lib/db.js';
import { prisma } from '../../lib/prisma.js';

export interface LockedResetCode {
  id: bigint;
  codeHash: string;
  attempts: number;
}

export const passwordResetRepository = {
  /** How many codes the user requested since `since` (daily cap) and when the last one was. */
  async recentRequests(
    userId: bigint,
    since: Date,
    db: Db = prisma,
  ): Promise<{ count: number; latest: Date | null }> {
    const [count, latest] = await Promise.all([
      db.passwordResetCode.count({ where: { userId, createdAt: { gte: since } } }),
      db.passwordResetCode.findFirst({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        select: { createdAt: true },
      }),
    ]);
    return { count, latest: latest?.createdAt ?? null };
  },

  /** A new code replaces every older one that could still be used. */
  async expireActive(userId: bigint, now: Date, db: Db): Promise<void> {
    await db.passwordResetCode.updateMany({
      where: { userId, usedAt: null, expiresAt: { gt: now } },
      data: { expiresAt: now },
    });
  },

  async create(userId: bigint, codeHash: string, expiresAt: Date, db: Db): Promise<void> {
    await db.passwordResetCode.create({ data: { userId, codeHash, expiresAt } });
  },

  /**
   * The newest usable code, LOCKED until the transaction ends: two guesses at the same
   * time are serialized, so the attempt counter cannot be raced past its limit.
   */
  async lockLatestActive(userId: bigint, now: Date, db: Db): Promise<LockedResetCode | null> {
    const [row] = await db.$queryRaw<{ code_id: bigint; code_hash: string; attempts: number }[]>(
      Prisma.sql`
        SELECT code_id, code_hash, attempts
        FROM password_reset_codes
        WHERE user_id = ${userId} AND used_at IS NULL AND expires_at > ${now}
        ORDER BY created_at DESC
        LIMIT 1
        FOR UPDATE`,
    );
    return row ? { id: row.code_id, codeHash: row.code_hash, attempts: row.attempts } : null;
  },

  async recordFailure(codeId: bigint, db: Db): Promise<number> {
    const { attempts } = await db.passwordResetCode.update({
      where: { id: codeId },
      data: { attempts: { increment: 1 } },
      select: { attempts: true },
    });
    return attempts;
  },

  async markUsed(codeId: bigint, now: Date, db: Db): Promise<void> {
    await db.passwordResetCode.update({ where: { id: codeId }, data: { usedAt: now } });
  },
};

export type PasswordResetRepository = typeof passwordResetRepository;
