import { createHmac, randomInt, timingSafeEqual } from 'node:crypto';
import {
  DEFAULT_LOCALE,
  type ForgotPasswordInput,
  isLocale,
  RESET_CODE_LENGTH,
  type ResetPasswordInput,
} from '@income-expenses/shared';
import { config } from '../../config/index.js';
import { runInTransaction, type TransactionRunner } from '../../lib/db.js';
import { AppError, detail, errors } from '../../lib/errors.js';
import { logger as rootLogger } from '../../lib/logger.js';
import { type Mailer, mailer as defaultMailer } from '../../lib/mailer.js';
import { hashPassword } from '../../lib/password.js';
import { type RefreshTokensRepository, refreshTokensRepository } from '../auth/auth.repository.js';
import { type UsersRepository, usersRepository } from '../users/users.repository.js';
import { buildResetEmail } from './reset-email.js';
import {
  type PasswordResetRepository,
  passwordResetRepository,
} from './password-reset.repository.js';

export const RESET_CODE_TTL_MINUTES = 10;
export const MAX_ATTEMPTS = 5;
/** Minimum gap between two codes for the same account (also the resend countdown in the UI). */
export const RESEND_COOLDOWN_SECONDS = 60;
export const MAX_REQUESTS_PER_DAY = 5;

interface Deps {
  users: UsersRepository;
  codes: PasswordResetRepository;
  refreshTokens: RefreshTokensRepository;
  transaction: TransactionRunner;
  mailer: Mailer;
  secret: string;
  logger: Pick<typeof rootLogger, 'info' | 'warn' | 'error'>;
  now?: () => Date;
}

type ResetOutcome = 'ok' | 'invalid' | 'locked';

export function createPasswordResetService(deps: Deps) {
  const { users, codes, refreshTokens, transaction, mailer, secret, logger } = deps;
  const now = deps.now ?? (() => new Date());

  /** Stored instead of the code. Keyed and bound to the user, so a DB leak alone is not enough. */
  const hashCode = (userId: bigint, code: string) =>
    createHmac('sha256', secret).update(`${userId.toString()}.${code}`).digest('hex');

  /** 6 digits from a CSPRNG (never Math.random), zero-padded: "004217". */
  const newCode = () =>
    randomInt(0, 10 ** RESET_CODE_LENGTH)
      .toString()
      .padStart(RESET_CODE_LENGTH, '0');

  const sameHash = (a: string, b: string) =>
    a.length === b.length && timingSafeEqual(Buffer.from(a, 'hex'), Buffer.from(b, 'hex'));

  return {
    /**
     * Always ends the same way for the caller (202), whether the email has an account or
     * not, whether a code was actually sent or throttled: the response must not reveal
     * which addresses are registered. The email itself is sent in the background.
     */
    async requestReset({ email }: ForgotPasswordInput): Promise<void> {
      if (!mailer.enabled) {
        throw new AppError('INTERNAL_ERROR', 'errors.emailUnavailable', { status: 503 });
      }
      const user = await users.findByEmail(email);
      if (!user) return;

      const at = now();
      const recent = await codes.recentRequests(user.id, new Date(at.getTime() - 86_400_000));
      if (
        recent.latest &&
        at.getTime() - recent.latest.getTime() < RESEND_COOLDOWN_SECONDS * 1000
      ) {
        logger.info({ userId: user.id.toString() }, 'Password reset throttled (cooldown)');
        return;
      }
      if (recent.count >= MAX_REQUESTS_PER_DAY) {
        logger.warn({ userId: user.id.toString() }, 'Password reset throttled (daily cap)');
        return;
      }

      const code = newCode();
      await transaction(async (tx) => {
        await codes.expireActive(user.id, at, tx);
        await codes.create(
          user.id,
          hashCode(user.id, code),
          new Date(at.getTime() + RESET_CODE_TTL_MINUTES * 60_000),
          tx,
        );
      });

      const message = buildResetEmail({
        to: user.email,
        displayName: user.displayName,
        code,
        locale: isLocale(user.locale) ? user.locale : DEFAULT_LOCALE,
        minutes: RESET_CODE_TTL_MINUTES,
      });
      // Not awaited: the response time must not depend on the SMTP server (or on whether
      // this address exists). A failure is logged; the user can ask for a new code.
      void mailer.send(message).catch((error: unknown) => {
        logger.error({ err: error, userId: user.id.toString() }, 'Password reset email failed');
      });
    },

    async resetPassword({ email, code, newPassword }: ResetPasswordInput): Promise<void> {
      const invalid = () =>
        errors.validation('validation.resetCodeInvalid', [
          detail('code', 'validation.resetCodeInvalid'),
        ]);
      const user = await users.findByEmail(email);
      if (!user) throw invalid();

      // Hash before taking the row lock: bcrypt is the slow part (~250 ms at cost 12).
      const passwordHash = await hashPassword(newPassword);
      const at = now();

      // The transaction RETURNS the outcome instead of throwing inside it: a throw would
      // roll back the attempts + 1 and give an attacker unlimited guesses.
      const outcome = await transaction(async (tx): Promise<ResetOutcome> => {
        const row = await codes.lockLatestActive(user.id, at, tx);
        if (!row) return 'invalid';
        if (row.attempts >= MAX_ATTEMPTS) return 'locked';
        if (!sameHash(row.codeHash, hashCode(user.id, code))) {
          const attempts = await codes.recordFailure(row.id, tx);
          return attempts >= MAX_ATTEMPTS ? 'locked' : 'invalid';
        }
        await codes.markUsed(row.id, at, tx);
        await codes.expireActive(user.id, at, tx);
        await users.updatePasswordHash(user.id, passwordHash, tx);
        // Whoever had a session (maybe the reason for the reset) is logged out everywhere.
        await refreshTokens.deleteAllForUser(user.id, tx);
        return 'ok';
      });

      if (outcome === 'locked') {
        throw errors.validation('validation.resetCodeLocked', [
          detail('code', 'validation.resetCodeLocked'),
        ]);
      }
      if (outcome === 'invalid') throw invalid();
      logger.info({ userId: user.id.toString() }, 'Password reset completed');
    },
  };
}

export type PasswordResetService = ReturnType<typeof createPasswordResetService>;
export const passwordResetService = createPasswordResetService({
  users: usersRepository,
  codes: passwordResetRepository,
  refreshTokens: refreshTokensRepository,
  transaction: runInTransaction,
  mailer: defaultMailer,
  secret: config.PASSWORD_RESET_SECRET,
  logger: rootLogger,
});
