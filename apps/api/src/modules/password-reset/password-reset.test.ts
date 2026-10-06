import type { Express } from 'express';
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { createApp } from '../../app.js';
import { type createMemoryMailer, type MailMessage, mailer } from '../../lib/mailer.js';
import { prisma } from '../../lib/prisma.js';
import {
  getRefreshCookie,
  refreshCookieHeader,
  registerUser,
  TEST_PASSWORD,
} from '../../test/auth-helpers.js';
import { resetDatabase } from '../../test/db.js';
import { createPasswordResetService, MAX_ATTEMPTS } from './password-reset.service.js';

const API = '/api/v1/auth';
const NEW_PASSWORD = 'BrandNew123!';
const sent = (mailer as ReturnType<typeof createMemoryMailer>).sent;

let app: Express;

/** The 6-digit code from the last email sent to `to`. */
function codeFrom(to: string): string {
  const mail = [...sent].reverse().find((m) => m.to === to);
  const match = /\b(\d{6})\b/.exec(mail?.text ?? '');
  if (!match?.[1]) throw new Error(`no code emailed to ${to}`);
  return match[1];
}

const forgot = (email: string) => request(app).post(`${API}/forgot-password`).send({ email });
const reset = (email: string, code: string, newPassword = NEW_PASSWORD) =>
  request(app).post(`${API}/reset-password`).send({ email, code, newPassword });

async function codesOf(userId: string) {
  return prisma.passwordResetCode.findMany({
    where: { userId: BigInt(userId) },
    orderBy: { createdAt: 'desc' },
  });
}

beforeAll(async () => {
  await resetDatabase();
});

beforeEach(() => {
  // A fresh app = fresh per-IP rate-limit counters for every test.
  app = createApp();
  sent.length = 0;
});

afterAll(async () => {
  await prisma.$disconnect();
});

describe('POST /auth/forgot-password', () => {
  it('emails a 6-digit code in the account language and stores only its hash', async () => {
    const user = await registerUser(app, { locale: 'en', displayName: 'Ann' });

    const res = await forgot(user.email);

    expect(res.status).toBe(202);
    expect(sent).toHaveLength(1);
    const mail = sent[0] as MailMessage;
    expect(mail.to).toBe(user.email);
    expect(mail.subject).toBe('Your password reset code');
    expect(mail.html).toContain(codeFrom(user.email));

    const [row] = await codesOf(user.user.id);
    expect(row?.codeHash).toMatch(/^[0-9a-f]{64}$/);
    expect(row?.codeHash).not.toContain(codeFrom(user.email));
  });

  it('answers exactly the same for an email that has no account (no enumeration)', async () => {
    const known = await registerUser(app);
    const a = await forgot(known.email);
    const b = await forgot('nobody-here@example.com');

    expect([a.status, b.status]).toEqual([202, 202]);
    expect(a.text).toBe(b.text);
    expect(sent.map((m) => m.to)).toEqual([known.email]);
  });

  it('throttles: one code per minute, and a newer code replaces the older one', async () => {
    const user = await registerUser(app);
    await forgot(user.email);
    const first = codeFrom(user.email);

    expect((await forgot(user.email)).status).toBe(202); // same answer…
    expect(sent).toHaveLength(1); // …but no second email

    // A minute later a new code is sent, and the first one stops working.
    await prisma.passwordResetCode.updateMany({
      where: { userId: BigInt(user.user.id) },
      data: { createdAt: new Date(Date.now() - 61_000) },
    });
    await forgot(user.email);
    const second = codeFrom(user.email);
    expect(sent).toHaveLength(2);
    if (first !== second) {
      expect((await reset(user.email, first)).status).toBe(400);
    }
    expect((await reset(user.email, second)).status).toBe(204);
  });

  it('caps requests at 5 per account per day', async () => {
    const user = await registerUser(app);
    const hourAgo = new Date(Date.now() - 3_600_000);
    await prisma.passwordResetCode.createMany({
      data: Array.from({ length: 5 }, () => ({
        userId: BigInt(user.user.id),
        codeHash: '0'.repeat(64),
        expiresAt: hourAgo,
        createdAt: hourAgo,
      })),
    });

    expect((await forgot(user.email)).status).toBe(202);
    expect(sent).toHaveLength(0);
  });

  it('escapes the display name in the HTML email', async () => {
    const user = await registerUser(app, { displayName: '<script>x</script>' });
    await forgot(user.email);
    expect(sent[0]?.html).not.toContain('<script>');
    expect(sent[0]?.html).toContain('&#60;script&#62;');
  });

  it('answers 503 (without looking anything up) when email is not configured', async () => {
    const service = createPasswordResetService({
      users: {} as never,
      codes: {} as never,
      refreshTokens: {} as never,
      transaction: () => {
        throw new Error('must not touch the database');
      },
      mailer: { enabled: false, send: () => Promise.resolve() },
      secret: 'x'.repeat(32),
      logger: { info() {}, warn() {}, error() {} },
    });
    await expect(service.requestReset({ email: 'a@b.co' })).rejects.toMatchObject({
      status: 503,
      key: 'errors.emailUnavailable',
    });
  });
});

describe('POST /auth/reset-password', () => {
  it('sets the new password, logs out every session and burns the code', async () => {
    const user = await registerUser(app);
    const oldRefresh = user.refreshToken;
    await forgot(user.email);
    const code = codeFrom(user.email);

    expect((await reset(user.email, code)).status).toBe(204);

    const login = (password: string) =>
      request(app).post(`${API}/login`).send({ email: user.email, password });
    expect((await login(TEST_PASSWORD)).status).toBe(401);
    const ok = await login(NEW_PASSWORD);
    expect(ok.status).toBe(200);
    expect(getRefreshCookie(ok)).toBeDefined();
    // The session from before the reset is gone.
    const refresh = await request(app)
      .post(`${API}/refresh`)
      .set('Cookie', refreshCookieHeader(oldRefresh));
    expect(refresh.status).toBe(401);
    // One use only.
    expect((await reset(user.email, code, 'Another123!')).status).toBe(400);
  });

  it('locks the code after 5 wrong attempts — even the right code fails then', async () => {
    const user = await registerUser(app);
    await forgot(user.email);
    const code = codeFrom(user.email);
    const wrong = code === '000000' ? '111111' : '000000';

    const answers: string[] = [];
    for (let i = 0; i < MAX_ATTEMPTS; i++) {
      answers.push((await reset(user.email, wrong)).body.error.key as string);
    }
    expect(answers.slice(0, -1).every((key) => key === 'validation.resetCodeInvalid')).toBe(true);
    expect(answers.at(-1)).toBe('validation.resetCodeLocked');

    const right = await reset(user.email, code);
    expect(right.status).toBe(400);
    expect(right.body.error.key).toBe('validation.resetCodeLocked');
  });

  it('never counts past the limit when guesses arrive at the same time (row lock)', async () => {
    const user = await registerUser(app);
    await forgot(user.email);
    const code = codeFrom(user.email);
    const wrong = code === '000000' ? '111111' : '000000';

    const results = await Promise.all(
      // 10 = under the per-IP rate limit (429), still twice the attempt limit.
      Array.from({ length: 10 }, () => reset(user.email, wrong).then((r) => r.status)),
    );

    // Without the lock, concurrent increments exceed 5 → CHECK violation → 500s.
    expect(results).toEqual(Array(results.length).fill(400));
    const [row] = await codesOf(user.user.id);
    expect(row?.attempts).toBe(MAX_ATTEMPTS);
  });

  it('rejects an expired code, and gives no hint for unknown emails', async () => {
    const user = await registerUser(app);
    await forgot(user.email);
    const code = codeFrom(user.email);
    await prisma.passwordResetCode.updateMany({
      where: { userId: BigInt(user.user.id) },
      data: { expiresAt: new Date(Date.now() - 1000) },
    });

    const expired = await reset(user.email, code);
    const unknown = await reset('nobody-here@example.com', code);
    expect(expired.status).toBe(400);
    expect(unknown.body.error.key).toBe(expired.body.error.key);
  });

  it('validates the code format and the new password rules', async () => {
    const user = await registerUser(app);
    const res = await reset(user.email, '12ab56', 'short');
    expect(res.status).toBe(400);
    const keys = (res.body.error.details as { path: string; key?: string }[]).map(
      (d) => `${d.path}:${d.key ?? ''}`,
    );
    expect(keys).toContain('code:validation.resetCodeFormat');
    expect(keys.some((k) => k.startsWith('newPassword:'))).toBe(true);
  });
});
