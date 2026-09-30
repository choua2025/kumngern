import type { Db } from '../../lib/db.js';
import { prisma } from '../../lib/prisma.js';

export interface StoredRefreshToken {
  id: bigint;
  userId: bigint;
  expiresAt: Date;
  revokedAt: Date | null;
}

interface RefreshTokenRow {
  token_id: bigint;
  user_id: bigint;
  expires_at: Date;
  revoked_at: Date | null;
}

/**
 * refresh_tokens table. Only SHA-256 hashes are ever stored or queried.
 *
 * `revoked_at` is set ONLY by rotation (and by reuse detection). Presenting a token
 * with revoked_at therefore always means "a rotated token was replayed" = theft.
 * Logout and password change DELETE rows instead: a token killed that way is simply
 * unknown afterwards (plain 401) and must not trigger reuse detection.
 */
export const refreshTokensRepository = {
  async create(
    data: { userId: bigint; tokenHash: string; expiresAt: Date },
    db: Db = prisma,
  ): Promise<void> {
    await db.refreshToken.create({ data });
  },

  /**
   * Row-locks the token until the surrounding transaction ends. Two concurrent
   * refreshes with the same token are serialized: the second one waits, then sees
   * the token already revoked (→ reuse detection) instead of minting a second pair.
   * Prisma has no FOR UPDATE API, so this is raw SQL (parameters are still bound).
   */
  async findByHashForUpdate(tokenHash: string, db: Db): Promise<StoredRefreshToken | null> {
    const rows = await db.$queryRaw<RefreshTokenRow[]>`
      SELECT token_id, user_id, expires_at, revoked_at
      FROM refresh_tokens
      WHERE token_hash = ${tokenHash}
      FOR UPDATE`;
    const row = rows[0];
    return row
      ? {
          id: row.token_id,
          userId: row.user_id,
          expiresAt: row.expires_at,
          revokedAt: row.revoked_at,
        }
      : null;
  },

  async revoke(id: bigint, db: Db = prisma): Promise<void> {
    await db.refreshToken.updateMany({
      where: { id, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  },

  async deleteByHash(tokenHash: string, db: Db = prisma): Promise<void> {
    await db.refreshToken.deleteMany({ where: { tokenHash } });
  },

  async deleteAllForUser(userId: bigint, db: Db = prisma): Promise<void> {
    await db.refreshToken.deleteMany({ where: { userId } });
  },

  async revokeAllForUser(userId: bigint, db: Db = prisma): Promise<void> {
    await db.refreshToken.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  },
};

export type RefreshTokensRepository = typeof refreshTokensRepository;
