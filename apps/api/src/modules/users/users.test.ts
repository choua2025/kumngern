import type { Express } from 'express';
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { createApp } from '../../app.js';
import { prisma } from '../../lib/prisma.js';
import {
  getRefreshCookie,
  refreshCookieHeader,
  registerUser,
  TEST_PASSWORD,
} from '../../test/auth-helpers.js';
import { resetDatabase } from '../../test/db.js';

let app: Express;

beforeAll(async () => {
  await resetDatabase();
});

beforeEach(() => {
  app = createApp();
});

afterAll(async () => {
  await prisma.$disconnect();
});

describe('PATCH /users/me', () => {
  it('updates display name, currency and timezone', async () => {
    const user = await registerUser(app);

    const res = await request(app)
      .patch('/api/v1/users/me')
      .set('Authorization', `Bearer ${user.accessToken}`)
      .send({ displayName: 'ชื่อใหม่', defaultCurrency: 'lak', timezone: 'Asia/Vientiane' });

    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({
      displayName: 'ชื่อใหม่',
      defaultCurrency: 'LAK',
      timezone: 'Asia/Vientiane',
    });
  });

  it('rejects an empty body, invalid timezone and unknown currency', async () => {
    const user = await registerUser(app);
    const patch = (body: object) =>
      request(app)
        .patch('/api/v1/users/me')
        .set('Authorization', `Bearer ${user.accessToken}`)
        .send(body);

    expect((await patch({})).status).toBe(400);
    expect((await patch({ timezone: 'Mars/Olympus' })).body.error.details[0].path).toBe('timezone');
    expect((await patch({ defaultCurrency: 'EUR' })).body.error.details[0].path).toBe(
      'defaultCurrency',
    );
  });

  it('only ever changes the caller — another user is untouched', async () => {
    const alice = await registerUser(app, { displayName: 'Alice' });
    const bob = await registerUser(app, { displayName: 'Bob' });

    await request(app)
      .patch('/api/v1/users/me')
      .set('Authorization', `Bearer ${alice.accessToken}`)
      .send({ displayName: 'Alice 2' })
      .expect(200);

    const bobNow = await prisma.user.findUniqueOrThrow({ where: { id: BigInt(bob.user.id) } });
    expect(bobNow.displayName).toBe('Bob');
  });

  it('requires authentication', async () => {
    await request(app).patch('/api/v1/users/me').send({ displayName: 'x' }).expect(401);
  });
});

describe('PATCH /users/me/password', () => {
  it('returns 400 (not 401) when the current password is wrong', async () => {
    const user = await registerUser(app);

    const res = await request(app)
      .patch('/api/v1/users/me/password')
      .set('Authorization', `Bearer ${user.accessToken}`)
      .send({ currentPassword: 'WrongPass999', newPassword: 'NewPassw0rd!' });

    expect(res.status).toBe(400);
    expect(res.body.error.details[0].path).toBe('currentPassword');
  });

  it('changes the password, logs out other devices and keeps this device logged in', async () => {
    const user = await registerUser(app);
    // A second device logs in
    const otherDevice = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: user.email, password: TEST_PASSWORD });
    const otherDeviceToken = getRefreshCookie(otherDevice) ?? '';

    const res = await request(app)
      .patch('/api/v1/users/me/password')
      .set('Authorization', `Bearer ${user.accessToken}`)
      .send({ currentPassword: TEST_PASSWORD, newPassword: 'NewPassw0rd!' });

    expect(res.status).toBe(200);
    const thisDeviceToken = getRefreshCookie(res) ?? '';

    // Other device's session is gone...
    await request(app)
      .post('/api/v1/auth/refresh')
      .set('Cookie', refreshCookieHeader(otherDeviceToken))
      .expect(401);
    // ...and its failed refresh must NOT be mistaken for token theft, which would
    // also revoke the fresh session this device just received.
    await request(app)
      .post('/api/v1/auth/refresh')
      .set('Cookie', refreshCookieHeader(thisDeviceToken))
      .expect(200);

    // Old password no longer works, new one does
    await request(app)
      .post('/api/v1/auth/login')
      .send({ email: user.email, password: TEST_PASSWORD })
      .expect(401);
    await request(app)
      .post('/api/v1/auth/login')
      .send({ email: user.email, password: 'NewPassw0rd!' })
      .expect(200);
  });

  it('rejects reusing the current password as the new one', async () => {
    const user = await registerUser(app);

    const res = await request(app)
      .patch('/api/v1/users/me/password')
      .set('Authorization', `Bearer ${user.accessToken}`)
      .send({ currentPassword: TEST_PASSWORD, newPassword: TEST_PASSWORD });

    expect(res.status).toBe(400);
    expect(res.body.error.details[0].path).toBe('newPassword');
  });
});

describe('GET /currencies', () => {
  it('is public and returns the seeded currencies', async () => {
    const res = await request(app).get('/api/v1/currencies');

    expect(res.status).toBe(200);
    expect((res.body.data as { code: string }[]).map((c) => c.code)).toEqual(['LAK', 'THB', 'USD']);
  });
});
