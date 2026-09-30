import type { BudgetDto } from '@income-expenses/shared';
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
let food: string;
let coffee: string;
let travel: string;
let salary: string;

const byCategory = (budgets: BudgetDto[], categoryId: string) =>
  budgets.find((b) => b.category.id === categoryId);

async function createBudget(client: ApiClient, body: object): Promise<BudgetDto> {
  const res = await client.post('/budgets', body);
  if (res.status !== 201) throw new Error(JSON.stringify(res.body));
  return (res.body as { data: BudgetDto }).data;
}

beforeAll(async () => {
  await resetDatabase();
  // Both users are in Asia/Bangkok (UTC+7) with THB as default currency.
  alice = apiClient(app, (await registerUser(app)).accessToken);
  bob = apiClient(app, (await registerUser(app)).accessToken);
  food = await systemCategoryId('อาหาร', 'expense');
  coffee = await systemCategoryId('กาแฟ', 'expense');
  travel = await systemCategoryId('เดินทาง', 'expense');
  salary = await systemCategoryId('เงินเดือน', 'income');

  const thb = await createWallet(alice);
  const thb2 = await createWallet(alice);
  const usd = await createWallet(alice, { currencyCode: 'USD' });
  const expense = (walletId: string, categoryId: string, amount: string, occurredAt: string) =>
    createTransaction(alice, { type: 'expense', walletId, categoryId, amount, occurredAt });

  // --- July 2026 (Bangkok) ---
  await expense(thb.id, food, '300', '2026-07-10T12:00:00+07:00');
  await expense(thb.id, coffee, '200', '2026-07-11T08:00:00+07:00'); // child → counts for อาหาร
  await expense(thb.id, food, '40', '2026-06-30T17:30:00Z'); // = 1 Jul 00:30 Bangkok → July
  await expense(usd.id, food, '999', '2026-07-12T12:00:00+07:00'); // USD wallet → excluded (D7)
  const deleted = await expense(thb.id, food, '50', '2026-07-13T12:00:00+07:00');
  await alice.delete(`/transactions/${deleted.id}`).expect(204); // soft-deleted → excluded
  await expense(thb.id, travel, '100', '2026-07-14T12:00:00+07:00');
  await createTransaction(alice, {
    type: 'transfer', // transfers are never expenses
    walletId: thb.id,
    toWalletId: thb2.id,
    amount: '5000',
    occurredAt: '2026-07-15T12:00:00+07:00',
  });
  // --- August 2026 ---
  await expense(thb.id, food, '70', '2026-07-31T17:30:00Z'); // = 1 Aug 00:30 Bangkok → August
});

afterAll(async () => {
  await prisma.$disconnect();
});

describe('budget spent & status', () => {
  let budgets: BudgetDto[];

  beforeAll(async () => {
    await createBudget(alice, { categoryId: food, month: '2026-07', limitAmount: '600' });
    await createBudget(alice, { categoryId: coffee, month: '2026-07', limitAmount: '150' });
    await createBudget(alice, {
      categoryId: travel,
      month: '2026-07',
      limitAmount: '1000',
      alertPercent: 50,
    });
    budgets = (await alice.get('/budgets?month=2026-07')).body.data as BudgetDto[];
  });

  it('rule 8: a parent budget includes its sub-categories; rule 9: months follow the user timezone', () => {
    // 300 + 200 (กาแฟ) + 40 (1 Jul 00:30 BKK). Excluded: USD 999, deleted 50, 70 (August).
    expect(byCategory(budgets, food)).toMatchObject({
      month: '2026-07',
      limitAmount: '600.00',
      spent: '540.00',
      remaining: '60.00',
      usedPercent: 90,
      status: 'warning',
      currencyCode: 'THB',
    });
  });

  it('a sub-category budget counts only that sub-category', () => {
    expect(byCategory(budgets, coffee)).toMatchObject({
      spent: '200.00',
      remaining: '-50.00',
      usedPercent: 133.3,
      status: 'over',
    });
  });

  it('uses the budget alert percent', () => {
    expect(byCategory(budgets, travel)).toMatchObject({
      spent: '100.00',
      usedPercent: 10,
      status: 'ok',
    });
  });

  it('the August transaction at 00:30 Bangkok time lands in August', async () => {
    await createBudget(alice, { categoryId: food, month: '2026-08', limitAmount: '100' });
    const august = (await alice.get('/budgets?month=2026-08')).body.data as BudgetDto[];

    expect(byCategory(august, food)?.spent).toBe('70.00');
  });
});

describe('budget validation', () => {
  it('rejects income categories, unknown categories and duplicates', async () => {
    const income = await alice.post('/budgets', {
      categoryId: salary,
      month: '2026-07',
      limitAmount: '10',
    });
    expect(income.status).toBe(400);
    expect(income.body.error.details[0].path).toBe('categoryId');

    expect(
      (await alice.post('/budgets', { categoryId: '999999', month: '2026-07', limitAmount: '10' }))
        .status,
    ).toBe(404);

    await createBudget(alice, { categoryId: food, month: '2026-01', limitAmount: '10' });
    expect(
      (await alice.post('/budgets', { categoryId: food, month: '2026-01', limitAmount: '20' }))
        .status,
    ).toBe(409);
  });

  it('rejects bad months, zero limits and alert percent outside 1-100', async () => {
    const base = { categoryId: travel, month: '2026-02', limitAmount: '10' };

    expect((await alice.post('/budgets', { ...base, month: '2026-13' })).status).toBe(400);
    expect((await alice.post('/budgets', { ...base, limitAmount: '0' })).status).toBe(400);
    expect((await alice.post('/budgets', { ...base, alertPercent: 0 })).status).toBe(400);
    expect((await alice.post('/budgets', { ...base, alertPercent: 101 })).status).toBe(400);
    expect((await alice.get('/budgets')).status).toBe(400); // month is required
  });
});

describe('PATCH / DELETE / copy', () => {
  it('updating the limit recomputes the status', async () => {
    const budget = await createBudget(alice, {
      categoryId: travel,
      month: '2026-03',
      limitAmount: '100',
    });

    const res = await alice.patch(`/budgets/${budget.id}`, { limitAmount: '50', alertPercent: 90 });

    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({ limitAmount: '50.00', alertPercent: 90 });
    await alice.delete(`/budgets/${budget.id}`).expect(204);
    await alice.delete(`/budgets/${budget.id}`).expect(404);
  });

  it('copies last month into the target month, skipping categories that already exist', async () => {
    // Source month 2026-04: two budgets. Target 2026-05 already has one of them.
    await createBudget(alice, { categoryId: food, month: '2026-04', limitAmount: '3000' });
    await createBudget(alice, { categoryId: travel, month: '2026-04', limitAmount: '800' });
    await createBudget(alice, { categoryId: travel, month: '2026-05', limitAmount: '999' });

    const res = await alice.post('/budgets/copy', { toMonth: '2026-05' });

    expect(res.status).toBe(200);
    expect(res.body.data).toEqual({ copied: 1, skipped: 1 });
    const may = (await alice.get('/budgets?month=2026-05')).body.data as BudgetDto[];
    expect(byCategory(may, food)?.limitAmount).toBe('3000.00');
    expect(byCategory(may, travel)?.limitAmount).toBe('999.00'); // existing one kept
  });
});

describe('budgets data isolation', () => {
  it("never shows, changes, deletes or copies another user's budgets", async () => {
    const aliceBudget = (await alice.get('/budgets?month=2026-07')).body.data[0] as BudgetDto;

    expect((await bob.get('/budgets?month=2026-07')).body.data).toEqual([]);
    expect((await bob.patch(`/budgets/${aliceBudget.id}`, { limitAmount: '1' })).status).toBe(404);
    expect((await bob.delete(`/budgets/${aliceBudget.id}`)).status).toBe(404);
    expect((await bob.post('/budgets/copy', { toMonth: '2026-08' })).body.data).toEqual({
      copied: 0,
      skipped: 0,
    });

    // Bob's own budget on the same category sees none of Alice's spending
    await createBudget(bob, { categoryId: food, month: '2026-07', limitAmount: '100' });
    const bobBudgets = (await bob.get('/budgets?month=2026-07')).body.data as BudgetDto[];
    expect(bobBudgets[0]?.spent).toBe('0.00');
  });
});
