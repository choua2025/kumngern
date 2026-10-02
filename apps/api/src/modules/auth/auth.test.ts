import type { Express } from 'express';
import jwt from 'jsonwebtoken';
import request, { type Response } from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { createApp } from '../../app.js';
import { config } from '../../config/index.js';
import { prisma } from '../../lib/prisma.js';
import { hashRefreshToken } from '../../lib/tokens.js';
import { refreshTokensRepository } from './auth.repository.js';
import {
  getRefreshCookie,
  refreshCookieHeader,
  registerUser,
  TEST_PASSWORD,
  uniqueEmail,
} from '../../test/auth-helpers.js';
import { resetDatabase } from '../../test/db.js';

const AUTH = '/api/v1/auth';

let app: Express;

beforeAll(async () => {
  await resetDatabase();
});

beforeEach(() => {
  // Fresh app = fresh in-memory rate-limit counters for every test.
  app = createApp();
});

afterAll(async () => {
  await prisma.$disconnect();
});

describe('full flow: register → login → refresh → logout', () => {
  it('works end to end', async () => {
    const email = uniqueEmail('flow');

    // 1. register
    const registered = await request(app).post(`${AUTH}/register`).send({
      email,
      password: TEST_PASSWORD,
      displayName: 'Flow',
      defaultCurrency: 'THB',
    });
    expect(registered.status).toBe(201);

    // 2. login
    const loggedIn = await request(app)
      .post(`${AUTH}/login`)
      .send({ email, password: TEST_PASSWORD });
    expect(loggedIn.status).toBe(200);
    const accessToken = (loggedIn.body as { data: { accessToken: string } }).data.accessToken;
    const refreshToken = getRefreshCookie(loggedIn);
    expect(refreshToken).toBeDefined();

    // access token works
    await request(app).get(`${AUTH}/me`).set('Authorization', `Bearer ${accessToken}`).expect(200);

    // 3. refresh → new pair
    const refreshed = await request(app)
      .post(`${AUTH}/refresh`)
      .set('Cookie', refreshCookieHeader(refreshToken ?? ''));
    expect(refreshed.status).toBe(200);
    const newRefreshToken = getRefreshCookie(refreshed);
    expect(newRefreshToken).toBeDefined();
    expect(newRefreshToken).not.toBe(refreshToken);

    // 4. logout → cookie cleared, token revoked
    const loggedOut = await request(app)
      .post(`${AUTH}/logout`)
      .set('Cookie', refreshCookieHeader(newRefreshToken ?? ''));
    expect(loggedOut.status).toBe(204);
    expect(String(loggedOut.headers['set-cookie'])).toMatch(/rt=;.*Expires=Thu, 01 Jan 1970/);

    await request(app)
      .post(`${AUTH}/refresh`)
      .set('Cookie', refreshCookieHeader(newRefreshToken ?? ''))
      .expect(401);
  });
});

describe('POST /auth/register', () => {
  it('creates the user, returns a DTO without the password hash and sets a secure cookie', async () => {
    const res = await request(app).post(`${AUTH}/register`).send({
      email: '  New.User@Example.COM ',
      password: TEST_PASSWORD,
      displayName: ' สมชาย ',
      defaultCurrency: 'thb',
    });

    expect(res.status).toBe(201);
    expect(res.body.data.user).toEqual({
      id: expect.stringMatching(/^\d+$/) as unknown,
      email: 'new.user@example.com',
      displayName: 'สมชาย',
      defaultCurrency: 'THB',
      timezone: 'Asia/Bangkok',
      locale: 'th',
      createdAt: expect.any(String) as unknown,
    });
    expect(JSON.stringify(res.body)).not.toMatch(/password/i);
    expect(res.body.data.accessToken).toEqual(expect.any(String));

    const cookie = String(res.headers['set-cookie']);
    expect(cookie).toMatch(/^rt=/);
    expect(cookie).toMatch(/HttpOnly/);
    expect(cookie).toMatch(/SameSite=Strict/);
    expect(cookie).toMatch(/Path=\/api\/v1\/auth/);

    const stored = await prisma.user.findUniqueOrThrow({
      where: { email: 'new.user@example.com' },
    });
    expect(stored.passwordHash).toMatch(/^\$2[aby]\$/); // bcrypt, never plain text
  });

  it('stores only the SHA-256 hash of the refresh token', async () => {
    const user = await registerUser(app);

    const byHash = await prisma.refreshToken.count({
      where: { tokenHash: hashRefreshToken(user.refreshToken) },
    });
    const byRaw = await prisma.refreshToken.count({ where: { tokenHash: user.refreshToken } });
    expect(byHash).toBe(1);
    expect(byRaw).toBe(0);
  });

  it('returns 409 when the email is taken (case-insensitive)', async () => {
    const user = await registerUser(app);

    const res = await request(app).post(`${AUTH}/register`).send({
      email: user.email.toUpperCase(),
      password: TEST_PASSWORD,
      displayName: 'Dup',
      defaultCurrency: 'THB',
    });

    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('CONFLICT');
  });

  it('rejects weak passwords, bad emails and unknown currencies with field details', async () => {
    const weak = await request(app).post(`${AUTH}/register`).send({
      email: 'not-an-email',
      password: 'abcdefgh',
      displayName: '',
      defaultCurrency: 'THB',
    });
    expect(weak.status).toBe(400);
    const paths = (weak.body.error.details as { path: string }[]).map((d) => d.path);
    expect(paths).toEqual(expect.arrayContaining(['email', 'password', 'displayName']));

    const currency = await request(app).post(`${AUTH}/register`).send({
      email: uniqueEmail(),
      password: TEST_PASSWORD,
      displayName: 'X',
      defaultCurrency: 'EUR',
    });
    expect(currency.status).toBe(400);
    expect(currency.body.error.details).toEqual([
      {
        path: 'defaultCurrency',
        message: 'This currency is not supported',
        key: 'validation.currencyUnsupported',
      },
    ]);
  });

  it('ignores unknown fields such as passwordHash (mass assignment)', async () => {
    const email = uniqueEmail();
    await request(app)
      .post(`${AUTH}/register`)
      .send({
        email,
        password: TEST_PASSWORD,
        displayName: 'X',
        defaultCurrency: 'THB',
        passwordHash: 'hacked',
        timezone: 'UTC',
      })
      .expect(201);

    const stored = await prisma.user.findUniqueOrThrow({ where: { email } });
    expect(stored.passwordHash).not.toBe('hacked');
    expect(stored.timezone).toBe('Asia/Bangkok');
  });
});

describe('POST /auth/login', () => {
  it('returns the same 401 for a wrong password and for an unknown email', async () => {
    const user = await registerUser(app);

    const wrongPassword = await request(app)
      .post(`${AUTH}/login`)
      .send({ email: user.email, password: 'WrongPass123' });
    const unknownEmail = await request(app)
      .post(`${AUTH}/login`)
      .send({ email: uniqueEmail('ghost'), password: 'WrongPass123' });

    expect(wrongPassword.status).toBe(401);
    expect(unknownEmail.status).toBe(401);
    expect(wrongPassword.body.error.message).toBe(unknownEmail.body.error.message);
  });

  it('is rate limited to 5 attempts per minute per IP', async () => {
    const attempt = () =>
      request(app).post(`${AUTH}/login`).send({ email: 'x@example.com', password: 'nope' });

    for (let i = 0; i < 5; i += 1) {
      expect((await attempt()).status).toBe(401);
    }
    const blocked = await attempt();

    expect(blocked.status).toBe(429);
    expect(blocked.body.error.code).toBe('RATE_LIMITED');
    expect(blocked.headers['retry-after']).toBeDefined();
  });
});

describe('GET /auth/me (requireAuth)', () => {
  it('returns the current user', async () => {
    const user = await registerUser(app);

    const res = await request(app)
      .get(`${AUTH}/me`)
      .set('Authorization', `Bearer ${user.accessToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data.email).toBe(user.email);
  });

  it.each([
    ['no header', undefined],
    ['not a bearer token', 'Basic abc'],
    ['garbage', 'Bearer not.a.jwt'],
    [
      'wrong secret',
      `Bearer ${jwt.sign({}, 'another-secret-another-secret-12345', { subject: '1' })}`,
    ],
    ['alg none', `Bearer ${jwt.sign({ sub: '1' }, '', { algorithm: 'none' })}x`],
  ])('returns 401 for %s', async (_label, header) => {
    const req = request(app).get(`${AUTH}/me`);
    const res = header ? await req.set('Authorization', header) : await req;

    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('UNAUTHORIZED');
  });

  it('returns 401 for an expired access token', async () => {
    const user = await registerUser(app);
    const expired = jwt.sign({}, config.JWT_ACCESS_SECRET, {
      subject: user.user.id,
      issuer: 'income-expenses-api',
      audience: 'income-expenses-web',
      expiresIn: -10,
    });

    const res = await request(app).get(`${AUTH}/me`).set('Authorization', `Bearer ${expired}`);

    expect(res.status).toBe(401);
  });
});

describe('POST /auth/refresh', () => {
  it('returns 401 and clears the cookie when no cookie is sent', async () => {
    const res = await request(app).post(`${AUTH}/refresh`);

    expect(res.status).toBe(401);
    expect(String(res.headers['set-cookie'])).toMatch(/rt=;/);
  });

  it('rejects an expired refresh token', async () => {
    const user = await registerUser(app);
    await prisma.refreshToken.updateMany({
      where: { tokenHash: hashRefreshToken(user.refreshToken) },
      data: { expiresAt: new Date(Date.now() - 1000) },
    });

    await request(app)
      .post(`${AUTH}/refresh`)
      .set('Cookie', refreshCookieHeader(user.refreshToken))
      .expect(401);
  });

  it('detects reuse of a rotated token and revokes ALL sessions of that user', async () => {
    const user = await registerUser(app);

    // Legit client rotates: token A → token B
    const first = await request(app)
      .post(`${AUTH}/refresh`)
      .set('Cookie', refreshCookieHeader(user.refreshToken));
    expect(first.status).toBe(200);
    const tokenB = getRefreshCookie(first) ?? '';

    // Attacker replays the stolen token A
    await request(app)
      .post(`${AUTH}/refresh`)
      .set('Cookie', refreshCookieHeader(user.refreshToken))
      .expect(401);

    // Token B (the legit one) is now dead too → everyone must log in again
    await request(app)
      .post(`${AUTH}/refresh`)
      .set('Cookie', refreshCookieHeader(tokenB))
      .expect(401);

    const active = await prisma.refreshToken.count({
      where: { user: { email: user.email }, revokedAt: null },
    });
    expect(active).toBe(0);
  });
});

describe('POST /auth/refresh — concurrency', () => {
  it('blocks a second refresh on the row lock until the first one has rotated the token', async () => {
    const user = await registerUser(app);
    const tokenHash = hashRefreshToken(user.refreshToken);
    let secondRequest: Promise<Response> | undefined;
    let secondFinished = false;

    // This transaction plays "request #1": it holds the row lock, then rotates the token.
    await prisma.$transaction(async (tx) => {
      await refreshTokensRepository.findByHashForUpdate(tokenHash, tx);

      secondRequest = request(app)
        .post(`${AUTH}/refresh`)
        .set('Cookie', refreshCookieHeader(user.refreshToken))
        .then((res) => {
          secondFinished = true;
          return res;
        });

      await new Promise((resolve) => setTimeout(resolve, 300));
      // Without FOR UPDATE request #2 would already have read "not revoked" and succeeded.
      expect(secondFinished).toBe(false);

      await tx.refreshToken.updateMany({ where: { tokenHash }, data: { revokedAt: new Date() } });
    });

    // After the lock is released, request #2 sees the rotated token → reuse → 401.
    const second = await secondRequest;
    expect(second?.status).toBe(401);
  });
});

describe('POST /auth/logout', () => {
  it('is idempotent and works without any cookie or access token', async () => {
    await request(app).post(`${AUTH}/logout`).expect(204);
    await request(app).post(`${AUTH}/logout`).set('Cookie', 'rt=unknown').expect(204);
  });
});
