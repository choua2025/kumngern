import type { WalletDto } from '@income-expenses/shared';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createApp } from '../../app.js';
import { prisma } from '../../lib/prisma.js';
import { registerUser } from '../../test/auth-helpers.js';
import { resetDatabase } from '../../test/db.js';
import {
  type ApiClient,
  apiClient,
  createTransaction,
  createWallet,
  systemCategoryId,
} from '../../test/fixtures.js';

const app = createApp();
let alice: ApiClient;
let bob: ApiClient;

beforeAll(async () => {
  await resetDatabase();
  alice = apiClient(app, (await registerUser(app)).accessToken);
  bob = apiClient(app, (await registerUser(app)).accessToken);
});

afterAll(async () => {
  await prisma.$disconnect();
});

describe('wallets CRUD', () => {
  it('creates a wallet whose balance starts at the initial balance', async () => {
    const res = await alice.post('/wallets', {
      name: 'บัตรเครดิต',
      type: 'credit_card',
      currencyCode: 'THB',
      initialBalance: '-1500.5',
    });

    expect(res.status).toBe(201);
    expect(res.body.data).toMatchObject({
      name: 'บัตรเครดิต',
      type: 'credit_card',
      currencyCode: 'THB',
      initialBalance: '-1500.50',
      balance: '-1500.50',
      isArchived: false,
    });
  });

  it('rejects duplicate names (per user), invalid types and unknown currencies', async () => {
    await createWallet(alice, { name: 'Dup' });

    expect(
      (await alice.post('/wallets', { name: 'Dup', type: 'cash', currencyCode: 'THB' })).status,
    ).toBe(409);
    expect(
      (await alice.post('/wallets', { name: 'X', type: 'crypto', currencyCode: 'THB' })).status,
    ).toBe(400);
    expect(
      (await alice.post('/wallets', { name: 'Y', type: 'cash', currencyCode: 'EUR' })).status,
    ).toBe(400);
    // Another user may use the same name
    expect(
      (await bob.post('/wallets', { name: 'Dup', type: 'cash', currencyCode: 'THB' })).status,
    ).toBe(201);
  });

  it('hides archived wallets unless includeArchived=true', async () => {
    const wallet = await createWallet(alice, { name: 'Old account' });
    await alice.patch(`/wallets/${wallet.id}`, { isArchived: true }).expect(200);

    const active = await alice.get('/wallets');
    const all = await alice.get('/wallets?includeArchived=true');

    const ids = (res: { body: { data: WalletDto[] } }) => res.body.data.map((w) => w.id);
    expect(ids(active)).not.toContain(wallet.id);
    expect(ids(all)).toContain(wallet.id);
  });

  it('deletes an unused wallet but refuses (409) one that has transactions', async () => {
    const unused = await createWallet(alice);
    await alice.delete(`/wallets/${unused.id}`).expect(204);

    const used = await createWallet(alice);
    const tx = await createTransaction(alice, {
      type: 'expense',
      walletId: used.id,
      categoryId: await systemCategoryId('อาหาร', 'expense'),
      amount: '50',
      occurredAt: new Date().toISOString(),
    });
    // Even after the only transaction is soft-deleted, the wallet has history.
    await alice.delete(`/transactions/${tx.id}`).expect(204);

    const res = await alice.delete(`/wallets/${used.id}`);
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('CONFLICT');
  });

  it('returns 400 for a non-numeric id instead of a database error', async () => {
    await alice.get('/wallets/abc').expect(400);
  });
});

describe('wallets data isolation', () => {
  it("never shows, changes or deletes another user's wallet (404, not 403)", async () => {
    const wallet = await createWallet(alice, { name: 'Alice private' });

    const list = await bob.get('/wallets?includeArchived=true');
    expect((list.body.data as WalletDto[]).map((w) => w.id)).not.toContain(wallet.id);

    expect((await bob.get(`/wallets/${wallet.id}`)).status).toBe(404);
    expect((await bob.patch(`/wallets/${wallet.id}`, { name: 'hacked' })).status).toBe(404);
    expect((await bob.delete(`/wallets/${wallet.id}`)).status).toBe(404);

    const unchanged = await alice.get(`/wallets/${wallet.id}`);
    expect(unchanged.body.data.name).toBe('Alice private');
  });
});
