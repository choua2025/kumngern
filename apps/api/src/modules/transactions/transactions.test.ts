import type { TransactionDto, WalletDto } from '@income-expenses/shared';
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
  getBalance,
  systemCategoryId,
} from '../../test/fixtures.js';

const app = createApp();
let alice: ApiClient;
let bob: ApiClient;
let aliceUserId: bigint;
let food: string;
let coffee: string;
let travel: string;
let salary: string;

const NOW = '2026-09-15T12:00:00+07:00';

beforeAll(async () => {
  await resetDatabase();
  const aliceUser = await registerUser(app);
  alice = apiClient(app, aliceUser.accessToken);
  aliceUserId = BigInt(aliceUser.user.id);
  bob = apiClient(app, (await registerUser(app)).accessToken);
  food = await systemCategoryId('อาหาร', 'expense');
  coffee = await systemCategoryId('กาแฟ', 'expense');
  travel = await systemCategoryId('เดินทาง', 'expense');
  salary = await systemCategoryId('เงินเดือน', 'income');
});

afterAll(async () => {
  await prisma.$disconnect();
});

const ids = (res: { body: { data: TransactionDto[] } }) => res.body.data.map((t) => t.id);

describe('v_wallet_balances follows every change', () => {
  it('create → update → delete → restore → transfer', async () => {
    const bank = await createWallet(alice, { initialBalance: '1000.00' });
    const cash = await createWallet(alice);

    const income = await createTransaction(alice, {
      type: 'income',
      walletId: bank.id,
      categoryId: salary,
      amount: '5000',
      occurredAt: NOW,
    });
    const lunch = await createTransaction(alice, {
      type: 'expense',
      walletId: bank.id,
      categoryId: food,
      amount: '120.50',
      occurredAt: NOW,
    });
    expect(await getBalance(alice, bank.id)).toBe('5879.50'); // 1000 + 5000 − 120.50

    // Update the amount
    await alice.patch(`/transactions/${lunch.id}`, { amount: '100.25' }).expect(200);
    expect(await getBalance(alice, bank.id)).toBe('5899.75');

    // Move the expense to another wallet: both balances change
    await alice.patch(`/transactions/${lunch.id}`, { walletId: cash.id }).expect(200);
    expect(await getBalance(alice, bank.id)).toBe('6000.00');
    expect(await getBalance(alice, cash.id)).toBe('-100.25');

    // Soft delete removes it from the balance, restore brings it back
    await alice.delete(`/transactions/${lunch.id}`).expect(204);
    expect(await getBalance(alice, cash.id)).toBe('0.00');
    await alice.post(`/transactions/${lunch.id}/restore`).expect(200);
    expect(await getBalance(alice, cash.id)).toBe('-100.25');

    // Transfer 1000 bank → cash
    await createTransaction(alice, {
      type: 'transfer',
      walletId: bank.id,
      toWalletId: cash.id,
      amount: '1000',
      occurredAt: NOW,
    });
    expect(await getBalance(alice, bank.id)).toBe('5000.00');
    expect(await getBalance(alice, cash.id)).toBe('899.75');

    // Deleting the income drops it again
    await alice.delete(`/transactions/${income.id}`).expect(204);
    expect(await getBalance(alice, bank.id)).toBe('0.00');
  });

  it('cross-currency transfer credits to_amount to the target wallet', async () => {
    const thb = await createWallet(alice, { initialBalance: '5000' });
    const usd = await createWallet(alice, { currencyCode: 'USD' });

    await createTransaction(alice, {
      type: 'transfer',
      walletId: thb.id,
      toWalletId: usd.id,
      amount: '3500',
      toAmount: '100',
      occurredAt: NOW,
    });

    expect(await getBalance(alice, thb.id)).toBe('1500.00');
    expect(await getBalance(alice, usd.id)).toBe('100.00');
  });
});

describe('business rules (spec 5.4)', () => {
  let thb: WalletDto;
  let thb2: WalletDto;
  let usd: WalletDto;

  beforeAll(async () => {
    thb = await createWallet(alice);
    thb2 = await createWallet(alice);
    usd = await createWallet(alice, { currencyCode: 'USD' });
  });

  it('rule 2: category type must match transaction type', async () => {
    const res = await alice.post('/transactions', {
      type: 'income',
      walletId: thb.id,
      categoryId: food,
      amount: '10',
      occurredAt: NOW,
    });

    expect(res.status).toBe(400);
    expect(res.body.error.details[0].path).toBe('categoryId');
  });

  it('rule 3: cross-currency transfer requires toAmount', async () => {
    const res = await alice.post('/transactions', {
      type: 'transfer',
      walletId: thb.id,
      toWalletId: usd.id,
      amount: '100',
      occurredAt: NOW,
    });

    expect(res.status).toBe(400);
    expect(res.body.error.details[0].path).toBe('toAmount');
  });

  it('rule 3: same-currency transfer must NOT have toAmount', async () => {
    const res = await alice.post('/transactions', {
      type: 'transfer',
      walletId: thb.id,
      toWalletId: thb2.id,
      amount: '100',
      toAmount: '100',
      occurredAt: NOW,
    });

    expect(res.status).toBe(400);
  });

  it('rule 4: archived wallet cannot receive new transactions (409)', async () => {
    const archived = await createWallet(alice);
    await alice.patch(`/wallets/${archived.id}`, { isArchived: true }).expect(200);

    const res = await alice.post('/transactions', {
      type: 'expense',
      walletId: archived.id,
      categoryId: food,
      amount: '10',
      occurredAt: NOW,
    });

    expect(res.status).toBe(409);
  });

  it('transfer to the same wallet is rejected by validation', async () => {
    const res = await alice.post('/transactions', {
      type: 'transfer',
      walletId: thb.id,
      toWalletId: thb.id,
      amount: '10',
      occurredAt: NOW,
    });

    expect(res.status).toBe(400);
  });

  it('rejects zero/negative/over-precise amounts and a missing timezone offset', async () => {
    const base = { type: 'expense', walletId: thb.id, categoryId: food, occurredAt: NOW };

    for (const amount of ['0', '0.00', '-5', '1.234', 12.5]) {
      expect((await alice.post('/transactions', { ...base, amount })).status).toBe(400);
    }
    const noOffset = await alice.post('/transactions', {
      ...base,
      amount: '1',
      occurredAt: '2026-09-15T12:00:00',
    });
    expect(noOffset.status).toBe(400);
  });

  it('PATCH re-validates the merged result (expense → transfer needs toWalletId)', async () => {
    const tx = await createTransaction(alice, {
      type: 'expense',
      walletId: thb.id,
      categoryId: food,
      amount: '10',
      occurredAt: NOW,
    });

    const missing = await alice.patch(`/transactions/${tx.id}`, { type: 'transfer' });
    expect(missing.status).toBe(400);
    const paths = (missing.body.error.details as { path: string }[]).map((d) => d.path);
    expect(paths).toContain('toWalletId');

    const ok = await alice.patch(`/transactions/${tx.id}`, {
      type: 'transfer',
      toWalletId: thb2.id,
    });
    expect(ok.status).toBe(200);
    expect(ok.body.data).toMatchObject({ type: 'transfer', category: null });
  });
});

describe('database CHECK constraint (last line of defense)', () => {
  it('rejects a transfer to the same wallet even when written directly to the DB', async () => {
    const wallet = await createWallet(alice);

    await expect(
      prisma.transaction.create({
        data: {
          userId: aliceUserId,
          type: 'transfer',
          walletId: BigInt(wallet.id),
          toWalletId: BigInt(wallet.id),
          amount: '10',
          occurredAt: new Date(),
        },
      }),
    ).rejects.toThrow(/chk_tx_shape/);
  });

  it('rejects an expense that has a to_wallet_id', async () => {
    const a = await createWallet(alice);
    const b = await createWallet(alice);

    await expect(
      prisma.transaction.create({
        data: {
          userId: aliceUserId,
          type: 'expense',
          walletId: BigInt(a.id),
          toWalletId: BigInt(b.id),
          categoryId: BigInt(food),
          amount: '10',
          occurredAt: new Date(),
        },
      }),
    ).rejects.toThrow(/chk_tx_shape/);
  });
});

describe('GET /transactions filters', () => {
  let wallet: WalletDto;
  let other: WalletDto;
  let late: TransactionDto;
  let coffeeTx: TransactionDto;

  beforeAll(async () => {
    wallet = await createWallet(alice);
    other = await createWallet(alice);
    // 01:00 on 1 Oct in Bangkok = 18:00 on 30 Sep UTC
    late = await createTransaction(alice, {
      type: 'expense',
      walletId: wallet.id,
      categoryId: travel,
      amount: '40',
      note: 'แท็กซี่หลังเที่ยงคืน',
      occurredAt: '2026-09-30T18:00:00Z',
    });
    coffeeTx = await createTransaction(alice, {
      type: 'expense',
      walletId: wallet.id,
      categoryId: coffee,
      amount: '65',
      note: 'ส่วนลด 100%',
      occurredAt: '2026-09-20T02:00:00Z',
    });
    await createTransaction(alice, {
      type: 'expense',
      walletId: wallet.id,
      categoryId: food,
      amount: '1000',
      note: 'ข้าว 1000 บาท',
      occurredAt: '2026-09-21T05:00:00Z',
    });
    await createTransaction(alice, {
      type: 'transfer',
      walletId: other.id,
      toWalletId: wallet.id,
      amount: '500',
      occurredAt: '2026-09-22T05:00:00Z',
    });
  });

  it("rule 9: from/to are days in the user's timezone, not UTC", async () => {
    const october1 = await alice.get(
      `/transactions?walletId=${wallet.id}&from=2026-10-01&to=2026-10-01`,
    );
    const september30 = await alice.get(
      `/transactions?walletId=${wallet.id}&from=2026-09-30&to=2026-09-30`,
    );

    expect(ids(october1)).toEqual([late.id]);
    expect(ids(september30)).toEqual([]);
  });

  it('walletId matches both source and destination of transfers', async () => {
    const res = await alice.get(`/transactions?walletId=${wallet.id}`);

    expect(res.body.meta.total).toBe(4);
    expect((res.body.data as TransactionDto[]).some((t) => t.type === 'transfer')).toBe(true);
  });

  it('categoryId of a parent includes its sub-categories (อาหาร includes กาแฟ)', async () => {
    const res = await alice.get(`/transactions?walletId=${wallet.id}&categoryId=${food}`);

    expect(res.body.meta.total).toBe(2);
    expect(ids(res)).toContain(coffeeTx.id);
  });

  it('q treats % and _ literally', async () => {
    const res = await alice.get(
      `/transactions?walletId=${wallet.id}&q=${encodeURIComponent('100%')}`,
    );

    expect(ids(res)).toEqual([coffeeTx.id]);
  });

  it('paginates with a stable order and reports the total', async () => {
    const page1 = await alice.get(`/transactions?walletId=${wallet.id}&limit=3&page=1`);
    const page2 = await alice.get(`/transactions?walletId=${wallet.id}&limit=3&page=2`);

    expect(page1.body.meta).toEqual({ page: 1, limit: 3, total: 4 });
    expect(page1.body.data).toHaveLength(3);
    expect(page2.body.data).toHaveLength(1);
    expect(ids(page1)[0]).toBe(late.id); // newest first by default
    expect(new Set([...ids(page1), ...ids(page2)]).size).toBe(4);
  });

  it('sorts by amount and rejects limit > 100', async () => {
    const res = await alice.get(`/transactions?walletId=${wallet.id}&sort=amount:desc`);
    expect((res.body.data as TransactionDto[]).map((t) => t.amount)).toEqual([
      '1000.00',
      '500.00',
      '65.00',
      '40.00',
    ]);

    expect((await alice.get('/transactions?limit=101')).status).toBe(400);
  });

  it('deleted=true lists only soft-deleted transactions (the trash)', async () => {
    const tx = await createTransaction(alice, {
      type: 'expense',
      walletId: other.id,
      categoryId: food,
      amount: '1',
      occurredAt: NOW,
    });
    await alice.delete(`/transactions/${tx.id}`).expect(204);

    const active = await alice.get(`/transactions?walletId=${other.id}`);
    const trash = await alice.get(`/transactions?walletId=${other.id}&deleted=true`);

    expect(ids(active)).not.toContain(tx.id);
    expect(ids(trash)).toEqual([tx.id]);
    expect((await alice.get(`/transactions/${tx.id}`)).status).toBe(404);
  });
});

describe('transactions data isolation', () => {
  it("never lets another user read, change, delete, restore or reference Alice's data", async () => {
    const wallet = await createWallet(alice);
    const tx = await createTransaction(alice, {
      type: 'expense',
      walletId: wallet.id,
      categoryId: food,
      amount: '99',
      occurredAt: NOW,
    });
    const bobWallet = await createWallet(bob);

    // Read
    expect((await bob.get(`/transactions/${tx.id}`)).status).toBe(404);
    expect(ids(await bob.get('/transactions?limit=100'))).not.toContain(tx.id);
    expect((await bob.get(`/transactions?walletId=${wallet.id}`)).body.data).toEqual([]);
    // Write
    expect((await bob.patch(`/transactions/${tx.id}`, { amount: '1' })).status).toBe(404);
    expect((await bob.delete(`/transactions/${tx.id}`)).status).toBe(404);
    await alice.delete(`/transactions/${tx.id}`).expect(204);
    expect((await bob.post(`/transactions/${tx.id}/restore`)).status).toBe(404);
    // Reference Alice's wallet from Bob's transaction (both as source and target)
    const useWallet = await bob.post('/transactions', {
      type: 'expense',
      walletId: wallet.id,
      categoryId: food,
      amount: '1',
      occurredAt: NOW,
    });
    const transferInto = await bob.post('/transactions', {
      type: 'transfer',
      walletId: bobWallet.id,
      toWalletId: wallet.id,
      amount: '1',
      occurredAt: NOW,
    });
    expect(useWallet.status).toBe(404);
    expect(transferInto.status).toBe(404);

    // Alice's balance was never touched by Bob
    expect(await getBalance(alice, wallet.id)).toBe('0.00');
  });

  it("rejects another user's category and tags", async () => {
    const aliceCategory = await alice.post('/categories', { name: 'Alice cat', type: 'expense' });
    const aliceTag = await prisma.tag.create({ data: { userId: aliceUserId, name: 'secret' } });
    const bobWallet = await createWallet(bob);

    const withCategory = await bob.post('/transactions', {
      type: 'expense',
      walletId: bobWallet.id,
      categoryId: aliceCategory.body.data.id,
      amount: '1',
      occurredAt: NOW,
    });
    const withTag = await bob.post('/transactions', {
      type: 'expense',
      walletId: bobWallet.id,
      categoryId: food,
      amount: '1',
      occurredAt: NOW,
      tagIds: [aliceTag.id.toString()],
    });

    expect(withCategory.status).toBe(404);
    expect(withTag.status).toBe(404);
  });
});
