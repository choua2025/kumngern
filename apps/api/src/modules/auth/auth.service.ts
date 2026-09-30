import type {
  ChangePasswordInput,
  LoginInput,
  RegisterInput,
  UserDto,
} from '@income-expenses/shared';
import { type Db, runInTransaction, type TransactionRunner } from '../../lib/db.js';
import { errors } from '../../lib/errors.js';
import { logger } from '../../lib/logger.js';
import { hashPassword, verifyAgainstDummyHash, verifyPassword } from '../../lib/password.js';
import {
  generateRefreshToken,
  hashRefreshToken,
  refreshTokenExpiresAt,
  signAccessToken,
} from '../../lib/tokens.js';
import { type CurrenciesService, currenciesService } from '../currencies/currencies.service.js';
import { toUserDto } from '../users/users.mapper.js';
import { type UsersRepository, usersRepository } from '../users/users.repository.js';
import { type RefreshTokensRepository, refreshTokensRepository } from './auth.repository.js';

export interface IssuedTokens {
  accessToken: string;
  /** Raw token for the cookie. Only its hash is stored in the database. */
  refreshToken: string;
  refreshTokenExpiresAt: Date;
}

export interface Session extends IssuedTokens {
  user: UserDto;
}

interface AuthServiceDeps {
  users: UsersRepository;
  refreshTokens: RefreshTokensRepository;
  currencies: CurrenciesService;
  transaction: TransactionRunner;
}

const INVALID_CREDENTIALS = 'อีเมลหรือรหัสผ่านไม่ถูกต้อง';
const SESSION_EXPIRED = 'เซสชันหมดอายุ กรุณาเข้าสู่ระบบใหม่';

export function createAuthService({
  users,
  refreshTokens,
  currencies,
  transaction,
}: AuthServiceDeps) {
  async function issueTokens(userId: bigint, db?: Db): Promise<IssuedTokens> {
    const refreshToken = generateRefreshToken();
    const expiresAt = refreshTokenExpiresAt();
    await refreshTokens.create(
      { userId, tokenHash: hashRefreshToken(refreshToken), expiresAt },
      db,
    );
    return {
      accessToken: signAccessToken(userId),
      refreshToken,
      refreshTokenExpiresAt: expiresAt,
    };
  }

  return {
    async register(input: RegisterInput): Promise<Session> {
      await currencies.assertExists(input.defaultCurrency);
      if (await users.findByEmail(input.email)) {
        // Unavoidable enumeration trade-off: the user must be told the email is taken.
        throw errors.conflict('อีเมลนี้ถูกใช้งานแล้ว');
      }

      // Hash before opening the transaction: bcrypt is slow and would hold a DB connection.
      const passwordHash = await hashPassword(input.password);

      return transaction(async (tx) => {
        const user = await users.create(
          {
            email: input.email,
            passwordHash,
            displayName: input.displayName,
            defaultCurrency: input.defaultCurrency,
          },
          tx,
        );
        return { user: toUserDto(user), ...(await issueTokens(user.id, tx)) };
      });
    },

    async login(input: LoginInput): Promise<Session> {
      const user = await users.findByEmail(input.email);
      const passwordOk = user
        ? await verifyPassword(input.password, user.passwordHash)
        : await verifyAgainstDummyHash(input.password);

      // Same message (and similar timing) whether the email exists or not.
      if (!user || !passwordOk) {
        throw errors.unauthorized(INVALID_CREDENTIALS);
      }
      return { user: toUserDto(user), ...(await issueTokens(user.id)) };
    },

    /**
     * Refresh token rotation: every refresh token works exactly once.
     * Presenting an already-revoked token means it was copied (stolen) → revoke
     * every session of that user so the attacker's copy dies too (design-doc D5).
     */
    async refresh(rawToken: string | undefined): Promise<IssuedTokens> {
      if (!rawToken) {
        throw errors.unauthorized(SESSION_EXPIRED);
      }
      const tokenHash = hashRefreshToken(rawToken);

      // The transaction must COMMIT the "revoke all" before we throw, so the outcome
      // is returned as a value and turned into an error afterwards.
      const outcome = await transaction(async (tx) => {
        const stored = await refreshTokens.findByHashForUpdate(tokenHash, tx);
        if (!stored) {
          return { status: 'invalid' } as const;
        }
        if (stored.revokedAt) {
          await refreshTokens.revokeAllForUser(stored.userId, tx);
          return { status: 'reused', userId: stored.userId } as const;
        }
        if (stored.expiresAt.getTime() <= Date.now()) {
          return { status: 'invalid' } as const;
        }
        await refreshTokens.revoke(stored.id, tx);
        return { status: 'ok', tokens: await issueTokens(stored.userId, tx) } as const;
      });

      switch (outcome.status) {
        case 'ok':
          return outcome.tokens;
        case 'reused':
          logger.warn(
            { userId: outcome.userId.toString() },
            'Refresh token reuse detected, all sessions revoked',
          );
          throw errors.unauthorized(SESSION_EXPIRED);
        case 'invalid':
          throw errors.unauthorized(SESSION_EXPIRED);
      }
    },

    /** Idempotent: logging out twice, or without a cookie, is not an error. */
    async logout(rawToken: string | undefined): Promise<void> {
      if (rawToken) {
        await refreshTokens.deleteByHash(hashRefreshToken(rawToken));
      }
    },

    /**
     * Ends every session (all devices), then starts a fresh one for the device that
     * made the change so the user is not logged out here (design-doc X6).
     * Old tokens are DELETED, not revoked: when another device later presents one,
     * it must get a plain 401 — not trigger reuse detection, which would also kill
     * the brand-new session of this device.
     */
    async changePassword(userId: bigint, input: ChangePasswordInput): Promise<IssuedTokens> {
      const user = await users.findById(userId);
      if (!user) {
        throw errors.unauthorized();
      }
      if (!(await verifyPassword(input.currentPassword, user.passwordHash))) {
        // 400, not 401: a 401 would make the web client try to refresh and log the user out.
        throw errors.validation('รหัสผ่านปัจจุบันไม่ถูกต้อง', [
          { path: 'currentPassword', message: 'รหัสผ่านปัจจุบันไม่ถูกต้อง' },
        ]);
      }

      const passwordHash = await hashPassword(input.newPassword);
      return transaction(async (tx) => {
        await users.updatePasswordHash(userId, passwordHash, tx);
        await refreshTokens.deleteAllForUser(userId, tx);
        return issueTokens(userId, tx);
      });
    },
  };
}

export type AuthService = ReturnType<typeof createAuthService>;

export const authService = createAuthService({
  users: usersRepository,
  refreshTokens: refreshTokensRepository,
  currencies: currenciesService,
  transaction: runInTransaction,
});
