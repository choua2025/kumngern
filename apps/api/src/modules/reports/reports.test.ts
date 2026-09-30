import type {
  ByCategoryReportDto,
  DailyReportDto,
  SummaryReportDto,
  TrendReportDto,
} from '@income-expenses/shared';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createApp } from '../../app.js';
import { prisma } from '../../lib/prisma.js';
import { addMonths, currentMonthIn } from '../../lib/month.js';
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
let carol: ApiClient;
let dave: ApiClient;
let foodId: string;

beforeAll(async () => {
  await resetDatabase();
  carol = apiClient(app, (await registerUser(app)).accessToken); // THB, Asia/Bangkok
  dave = apiClient(app, (await registerUser(app)).accessToken);
  foodId = await systemCategoryId('อาหาร', 'expense');
  const coffee = await systemCategoryId('กาแฟ', 'expense');
  const travel = await systemCategoryId('เดินทาง', 'expense');
  const salary = await systemCategoryId('เงินเดือน', 'income');

  const thb = await createWallet(carol);
  const thb2 = await createWallet(carol);
  const usd = await createWallet(carol, { currencyCode: 'USD' });
  const tx = (
    type: 'income' | 'expense',
    categoryId: string,
    amount: string,
    occurredAt: string,
    walletId = thb.id,
  ) => createTransaction(carol, { type, walletId, categoryId, amount, occurredAt });

  // May 2026: income 10000, expense 4000
  await tx('income', salary, '10000', '2026-05-01T09:00:00+07:00');
  await tx('expense', foodId, '1000', '2026-05-05T12:00:00+07:00');
  await tx('expense', coffee, '500', '2026-05-06T12:00:00+07:00');
  await tx('expense', travel, '2500', '2026-05-07T12:00:00+07:00');

  // June 2026: income 12000, expense 5000
  await tx('income', salary, '12000', '2026-06-01T09:00:00+07:00');
  await tx('expense', foodId, '2000', '2026-05-31T17:30:00Z'); // = 1 Jun 00:30 Bangkok
  await tx('expense', coffee, '1000', '2026-06-15T12:00:00+07:00');
  await tx('expense', travel, '1500', '2026-06-15T18:00:00+07:00');
  await tx('expense', travel, '500', '2026-06-30T23:59:00+07:00');
  // Noise that must NOT appear anywhere
  await tx('expense', foodId, '77', '2026-06-10T12:00:00+07:00', usd.id); // other currency
  const removed = await tx('expense', foodId, '888', '2026-06-11T12:00:00+07:00');
  await carol.delete(`/transactions/${removed.id}`).expect(204); // deleted
  await createTransaction(carol, {
    type: 'transfer',
    walletId: thb.id,
    toWalletId: thb2.id,
    amount: '3000',
    occurredAt: '2026-06-12T12:00:00+07:00',
  }); // transfer
});

afterAll(async () => {
  await prisma.$disconnect();
});

describe('GET /reports/summary', () => {
  it('returns totals, the previous month and % change', async () => {
    const res = await carol.get('/reports/summary?month=2026-06');
    const data = res.body.data as SummaryReportDto;

    expect(data).toEqual({
      currencyCode: 'THB',
      month: '2026-06',
      income: '12000.00',
      expense: '5000.00',
      net: '7000.00',
      previous: { month: '2026-05', income: '10000.00', expense: '4000.00', net: '6000.00' },
      // (12000-10000)/10000, (5000-4000)/4000, (7000-6000)/6000 = 16.666… → 16.7
      changePercent: { income: 20, expense: 25, net: 16.7 },
    });
  });

  it('returns null change when the previous month is zero (no division by zero)', async () => {
    const data = (await carol.get('/reports/summary?month=2026-05')).body.data as SummaryReportDto;

    expect(data.previous).toEqual({
      month: '2026-04',
      income: '0.00',
      expense: '0.00',
      net: '0.00',
    });
    expect(data.changePercent).toEqual({ income: null, expense: null, net: null });
  });
});

describe('GET /reports/by-category', () => {
  it('rolls sub-categories up into their parent and sorts by total', async () => {
    const res = await carol.get('/reports/by-category?from=2026-06-01&to=2026-06-30');
    const data = res.body.data as ByCategoryReportDto;

    expect(data.total).toBe('5000.00');
    expect(data.items.map((i) => [i.category.name, i.total, i.percent])).toEqual([
      ['อาหาร', '3000.00', 60], // 2000 + กาแฟ 1000
      ['เดินทาง', '2000.00', 40],
    ]);
  });

  it('supports type=income and validates the range', async () => {
    const income = (
      await carol.get('/reports/by-category?from=2026-06-01&to=2026-06-30&type=income')
    ).body.data as ByCategoryReportDto;
    expect(income.items.map((i) => i.total)).toEqual(['12000.00']);

    expect((await carol.get('/reports/by-category?from=2026-06-30&to=2026-06-01')).status).toBe(
      400,
    );
  });
});

describe('GET /reports/daily', () => {
  it('returns every day of the month, in the user timezone', async () => {
    const data = (await carol.get('/reports/daily?month=2026-06')).body.data as DailyReportDto;
    const byDate = Object.fromEntries(data.items.map((i) => [i.date, i.expense]));

    expect(data.items).toHaveLength(30);
    expect(byDate['2026-06-01']).toBe('2000.00'); // 00:30 Bangkok, 31 May in UTC
    expect(byDate['2026-06-15']).toBe('2500.00');
    expect(byDate['2026-06-30']).toBe('500.00'); // 23:59 Bangkok
    expect(byDate['2026-06-02']).toBe('0.00');
    expect(byDate['2026-06-10']).toBe('0.00'); // the USD expense is excluded
  });
});

describe('GET /reports/trend', () => {
  it('returns N months ending with the current month, zero-filled', async () => {
    const current = currentMonthIn('Asia/Bangkok');
    await createTransaction(carol, {
      type: 'income',
      walletId: (await createWallet(carol)).id,
      categoryId: await systemCategoryId('ฟรีแลนซ์', 'income'),
      amount: '123.45',
      occurredAt: new Date().toISOString(),
    });

    const data = (await carol.get('/reports/trend?months=3')).body.data as TrendReportDto;

    expect(data.items.map((i) => i.month)).toEqual([
      addMonths(current, -2),
      addMonths(current, -1),
      current,
    ]);
    expect(data.items.at(-1)?.income).toBe('123.45');
    expect((await carol.get('/reports/trend?months=25')).status).toBe(400);
  });
});

describe('reports data isolation', () => {
  it("another user's reports contain none of Carol's data", async () => {
    const summary = (await dave.get('/reports/summary?month=2026-06')).body
      .data as SummaryReportDto;
    const byCat = (await dave.get('/reports/by-category?from=2026-01-01&to=2026-12-31')).body
      .data as ByCategoryReportDto;
    const daily = (await dave.get('/reports/daily?month=2026-06')).body.data as DailyReportDto;

    expect(summary).toMatchObject({ income: '0.00', expense: '0.00' });
    expect(byCat.items).toEqual([]);
    expect(daily.items.every((d) => d.expense === '0.00')).toBe(true);
  });
});
