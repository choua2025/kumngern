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

const HEADER =
  'date,time,type,wallet,to_wallet,category,parent_category,amount,to_amount,currency,note,tags';

/** CSV body → lines without the BOM (rows contain no embedded newlines in these tests). */
const lines = (text: string) =>
  text
    .replace(/^\uFEFF/, '')
    .trimEnd()
    .split('\r\n');

beforeAll(async () => {
  await resetDatabase();
  alice = apiClient(app, (await registerUser(app)).accessToken); // Asia/Bangkok
  bob = apiClient(app, (await registerUser(app)).accessToken);

  const coffee = await systemCategoryId('กาแฟ', 'expense');
  const salary = await systemCategoryId('เงินเดือน', 'income');
  const bank = await createWallet(alice, { name: 'Bank, main' }); // comma → must be quoted
  const usd = await createWallet(alice, { name: 'USD', currencyCode: 'USD' });
  const tag = (await alice.post('/tags', { name: 'trip' })).body.data as { id: string };

  await createTransaction(alice, {
    type: 'expense',
    walletId: bank.id,
    categoryId: coffee,
    amount: '65.5',
    note: '=HYPERLINK("http://evil","x")',
    occurredAt: '2026-09-30T17:30:00Z', // 1 Oct 00:30 in Bangkok
    tagIds: [tag.id],
  });
  await createTransaction(alice, {
    type: 'income',
    walletId: bank.id,
    categoryId: salary,
    amount: '35000',
    note: 'เงินเดือน "กันยายน"',
    occurredAt: '2026-09-25T02:00:00Z',
  });
  await createTransaction(alice, {
    type: 'transfer',
    walletId: bank.id,
    toWalletId: usd.id,
    amount: '3500',
    toAmount: '100',
    occurredAt: '2026-09-20T05:00:00Z',
  });
});

afterAll(async () => {
  await prisma.$disconnect();
});

describe('GET /transactions/export.csv', () => {
  it('returns a UTF-8 CSV with BOM, download headers and the spec columns', async () => {
    const res = await alice.get('/transactions/export.csv');

    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toBe('text/csv; charset=utf-8');
    expect(res.headers['content-disposition']).toMatch(
      /^attachment; filename="transactions-\d{4}-\d{2}-\d{2}\.csv"$/,
    );
    expect(res.text.charCodeAt(0)).toBe(0xfeff); // Excel needs the BOM for Thai text
    expect(lines(res.text)[0]).toBe(HEADER);
    expect(lines(res.text)).toHaveLength(4); // header + 3 rows
  });

  it('formats rows in the user timezone, quotes values and neutralises formulas', async () => {
    const rows = lines((await alice.get('/transactions/export.csv')).text).slice(1);

    // Newest first: the coffee at 00:30 on 1 Oct Bangkok time (30 Sep in UTC)
    expect(rows[0]).toBe(
      `2026-10-01,00:30,expense,"Bank, main",,กาแฟ,อาหาร,65.50,,THB,"'=HYPERLINK(""http://evil"",""x"")",trip`,
    );
    expect(rows[1]).toBe(
      '2026-09-25,09:00,income,"Bank, main",,เงินเดือน,,35000.00,,THB,"เงินเดือน ""กันยายน""",',
    );
    expect(rows[2]).toBe('2026-09-20,12:00,transfer,"Bank, main",USD,,,3500.00,100.00,THB,,');
  });

  it('names system categories in the user language (users.locale)', async () => {
    await alice.patch('/users/me', { locale: 'en' }).expect(200);
    try {
      const rows = lines((await alice.get('/transactions/export.csv')).text).slice(1);
      expect(rows[0]).toContain(',Coffee,Food,');
      expect(rows[1]).toContain(',Salary,,');
    } finally {
      await alice.patch('/users/me', { locale: 'th' }).expect(200);
    }
  });

  it('applies the same filters as the list', async () => {
    const onlyIncome = lines((await alice.get('/transactions/export.csv?type=income')).text);
    const october = lines(
      (await alice.get('/transactions/export.csv?from=2026-10-01&to=2026-10-31')).text,
    );

    expect(onlyIncome).toHaveLength(2);
    expect(onlyIncome[1]).toContain('income');
    expect(october).toHaveLength(2);
    expect(october[1]).toContain('กาแฟ');
  });

  it('validates filters before streaming (400 JSON, not a broken CSV)', async () => {
    const res = await alice.get('/transactions/export.csv?from=2026-10-31&to=2026-10-01');

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('exports only the caller’s own data', async () => {
    const res = await bob.get('/transactions/export.csv');

    expect(lines(res.text)).toEqual([HEADER]);
  });

  it('is not mistaken for /transactions/:id', async () => {
    // Route order: /export.csv is registered before /:id
    expect((await alice.get('/transactions/export.csv')).status).toBe(200);
  });
});
