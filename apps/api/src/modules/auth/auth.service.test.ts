import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { User } from '../../generated/prisma/client.js';
import type { Db, TransactionRunner } from '../../lib/db.js';
import { AppError } from '../../lib/errors.js';
import { hashPassword } from '../../lib/password.js';
import { hashRefreshToken } from '../../lib/tokens.js';
import type { CurrenciesService } from '../currencies/currencies.service.js';
import type { UsersRepository } from '../users/users.repository.js';
import type { RefreshTokensRepository } from './auth.repository.js';
import { createAuthService } from './auth.service.js';

// Unit tests: repositories are replaced with mocks, so these run without a database
// and can force situations that are hard to set up for real (e.g. a reused token).

function makeUser(overrides: Partial<User> = {}): User {
  return {
    id: 1n,
    email: 'a@example.com',
    passwordHash: '',
    displayName: 'A',
    defaultCurrency: 'THB',
    timezone: 'Asia/Bangkok',
    locale: 'th',
    createdAt: new Date('2026-01-01T00:00:00Z'),
    updatedAt: new Date('2026-01-01T00:00:00Z'),
    ...overrides,
  };
}

function setup() {
  const users = {
    findById: vi.fn(),
    findByEmail: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    updatePasswordHash: vi.fn(),
  } satisfies Record<keyof UsersRepository, unknown>;
  const refreshTokens = {
    create: vi.fn(),
    findByHashForUpdate: vi.fn(),
    revoke: vi.fn(),
    revokeAllForUser: vi.fn(),
    deleteByHash: vi.fn(),
    deleteAllForUser: vi.fn(),
  } satisfies Record<keyof RefreshTokensRepository, unknown>;
  const currencies = {
    list: vi.fn(),
    assertExists: vi.fn(),
  } satisfies Record<keyof CurrenciesService, unknown>;
  // Fake transaction: just run the callback with a dummy client.
  const transaction: TransactionRunner = (work) => work({} as Db);

  // `satisfies` above fails to compile if a repository gains a method the mock lacks.
  const service = createAuthService({ users, refreshTokens, currencies, transaction });
  return { service, users, refreshTokens, currencies };
}

let ctx: ReturnType<typeof setup>;

beforeEach(() => {
  ctx = setup();
});

describe('authService.register', () => {
  it('does not create a user when the email is taken', async () => {
    ctx.users.findByEmail.mockResolvedValue(makeUser());

    await expect(
      ctx.service.register({
        email: 'a@example.com',
        password: 'Password123!',
        displayName: 'A',
        defaultCurrency: 'THB',
      }),
    ).rejects.toMatchObject({ code: 'CONFLICT' });
    expect(ctx.users.create).not.toHaveBeenCalled();
  });
});

describe('authService.login', () => {
  it('still spends time hashing when the email does not exist (timing attack)', async () => {
    ctx.users.findByEmail.mockResolvedValue(null);

    await expect(
      ctx.service.login({ email: 'ghost@example.com', password: 'whatever1' }),
    ).rejects.toMatchObject({ code: 'UNAUTHORIZED', key: 'errors.invalidCredentials' });
    expect(ctx.refreshTokens.create).not.toHaveBeenCalled();
  });

  it('issues tokens for correct credentials', async () => {
    ctx.users.findByEmail.mockResolvedValue(
      makeUser({ passwordHash: await hashPassword('Password123!') }),
    );

    const session = await ctx.service.login({ email: 'a@example.com', password: 'Password123!' });

    expect(session.accessToken).toMatch(/^[\w-]+\.[\w-]+\.[\w-]+$/);
    expect(ctx.refreshTokens.create).toHaveBeenCalledWith(
      expect.objectContaining({ userId: 1n, tokenHash: hashRefreshToken(session.refreshToken) }),
      undefined,
    );
  });
});

describe('authService.refresh', () => {
  const stored = (overrides: object = {}) => ({
    id: 10n,
    userId: 1n,
    expiresAt: new Date(Date.now() + 60_000),
    revokedAt: null,
    ...overrides,
  });

  it('rotates: revokes the old token and issues a new one', async () => {
    ctx.refreshTokens.findByHashForUpdate.mockResolvedValue(stored());

    const tokens = await ctx.service.refresh('old-token');

    expect(ctx.refreshTokens.revoke).toHaveBeenCalledWith(10n, expect.anything());
    expect(ctx.refreshTokens.create).toHaveBeenCalledOnce();
    expect(tokens.refreshToken).not.toBe('old-token');
  });

  it('revokes every session of the user when a revoked token is reused', async () => {
    ctx.refreshTokens.findByHashForUpdate.mockResolvedValue(stored({ revokedAt: new Date() }));

    await expect(ctx.service.refresh('stolen-token')).rejects.toBeInstanceOf(AppError);
    expect(ctx.refreshTokens.revokeAllForUser).toHaveBeenCalledWith(1n, expect.anything());
    expect(ctx.refreshTokens.create).not.toHaveBeenCalled();
  });

  it('rejects an expired token without issuing anything', async () => {
    ctx.refreshTokens.findByHashForUpdate.mockResolvedValue(
      stored({ expiresAt: new Date(Date.now() - 1) }),
    );

    await expect(ctx.service.refresh('expired')).rejects.toMatchObject({ code: 'UNAUTHORIZED' });
    expect(ctx.refreshTokens.create).not.toHaveBeenCalled();
  });

  it('rejects a missing cookie without touching the database', async () => {
    await expect(ctx.service.refresh(undefined)).rejects.toMatchObject({ code: 'UNAUTHORIZED' });
    expect(ctx.refreshTokens.findByHashForUpdate).not.toHaveBeenCalled();
  });
});

describe('authService.changePassword', () => {
  it('returns a VALIDATION_ERROR (400) for a wrong current password', async () => {
    ctx.users.findById.mockResolvedValue(
      makeUser({ passwordHash: await hashPassword('Password123!') }),
    );

    await expect(
      ctx.service.changePassword(1n, { currentPassword: 'nope', newPassword: 'NewPassw0rd!' }),
    ).rejects.toMatchObject({ code: 'VALIDATION_ERROR', status: 400 });
    expect(ctx.users.updatePasswordHash).not.toHaveBeenCalled();
  });
});
