import type { CreateRecurringInput, RecurringDto } from '@income-expenses/shared';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createApp } from '../../app.js';
import { prisma } from '../../lib/prisma.js';
import { todayIn } from '../../lib/recurrence.js';
import { addDays } from '../../lib/time.js';
import { registerUser } from '../../test/auth-helpers.js';
import { resetDatabase } from '../../test/db.js';
import { type ApiClient, apiClient, createWallet, systemCategoryId } from '../../test/fixtures.js';

const app = createApp();
let alice: ApiClient;
let bob: ApiClient;
let walletId: string;
let food: string;
let salary: string;

/** Registered users default to Asia/Bangkok. */
const today = () => todayIn('Asia/Bangkok');

/** A date ≥ today whose day-of-month is ≤ 28, so it is valid for every frequency. */
function safeStartDate(): string {
  let date = addDays(today(), 1);
  while (Number(date.slice(8, 10)) > 28) date = addDays(date, 1);
  return date;
}

function input(overrides: Partial<CreateRecurringInput> = {}): CreateRecurringInput {
  return {
    type: 'expense',
    walletId,
    categoryId: food,
    amount: '5500',
    note: 'ค่าเช่าห้อง',
    frequency: 'monthly',
    nextRunDate: safeStartDate(),
    endDate: null,
    ...overrides,
  };
}

async function createRecurring(
  client: ApiClient,
  overrides: Partial<CreateRecurringInput> = {},
): Promise<RecurringDto> {
  const res = await client.post('/recurring', input(overrides));
  if (res.status !== 201) throw new Error(JSON.stringify(res.body));
  return (res.body as { data: RecurringDto }).data;
}

beforeAll(async () => {
  await resetDatabase();
  alice = apiClient(app, (await registerUser(app)).accessToken);
  bob = apiClient(app, (await registerUser(app)).accessToken);
  walletId = (await createWallet(alice)).id;
  food = await systemCategoryId('อาหาร', 'expense');
  salary = await systemCategoryId('เงินเดือน', 'income');
});

afterAll(async () => {
  await prisma.$disconnect();
});

describe('recurring CRUD', () => {
  it('creates, lists, updates and deletes', async () => {
    const created = await createRecurring(alice);
    expect(created).toMatchObject({
      type: 'expense',
      amount: '5500.00',
      note: 'ค่าเช่าห้อง',
      frequency: 'monthly',
      endDate: null,
      isActive: true,
      wallet: { id: walletId, currencyCode: 'THB' },
      category: { id: food, name: 'อาหาร' },
    });

    const list = (await alice.get('/recurring')).body.data as RecurringDto[];
    expect(list.map((r) => r.id)).toContain(created.id);

    const paused = await alice.patch(`/recurring/${created.id}`, {
      amount: '6000.5',
      isActive: false,
    });
    expect(paused.status).toBe(200);
    expect(paused.body.data).toMatchObject({ amount: '6000.50', isActive: false });

    await alice.delete(`/recurring/${created.id}`).expect(204);
    await alice.delete(`/recurring/${created.id}`).expect(404);
  });

  it('accepts today as the start date (in the user timezone)', async () => {
    const res = await alice.post('/recurring', input({ frequency: 'daily', nextRunDate: today() }));
    expect(res.status).toBe(201);
  });

  it('deleting a recurring keeps the transactions it created', async () => {
    const recurring = await createRecurring(alice);
    const wallet = await prisma.wallet.findFirstOrThrow({ where: { id: BigInt(walletId) } });
    const tx = await prisma.transaction.create({
      data: {
        userId: wallet.userId,
        type: 'expense',
        walletId: wallet.id,
        categoryId: BigInt(food),
        amount: '1',
        occurredAt: new Date(),
        recurringId: BigInt(recurring.id),
      },
    });

    await alice.delete(`/recurring/${recurring.id}`).expect(204);

    const after = await prisma.transaction.findUniqueOrThrow({ where: { id: tx.id } });
    expect(after.recurringId).toBeNull();
  });
});

describe('recurring validation', () => {
  it('rejects a start date in the past', async () => {
    const res = await alice.post('/recurring', input({ nextRunDate: addDays(today(), -1) }));
    expect(res.status).toBe(400);
    expect(res.body.error.details[0].path).toBe('nextRunDate');
  });

  it('rejects endDate before nextRunDate', async () => {
    const start = safeStartDate();
    const res = await alice.post(
      '/recurring',
      input({ nextRunDate: start, endDate: addDays(start, -1) }),
    );
    expect(res.status).toBe(400);
  });

  it('rejects day 29-31 for monthly/yearly but allows it for daily/weekly (D8)', async () => {
    const year = Number(today().slice(0, 4)) + 1;
    const day31 = `${year}-01-31`;
    expect((await alice.post('/recurring', input({ nextRunDate: day31 }))).status).toBe(400);
    expect(
      (await alice.post('/recurring', input({ frequency: 'yearly', nextRunDate: day31 }))).status,
    ).toBe(400);
    expect(
      (await alice.post('/recurring', input({ frequency: 'weekly', nextRunDate: day31 }))).status,
    ).toBe(201);
  });

  it('rejects a category of the wrong type (400) and an unknown one (404)', async () => {
    expect((await alice.post('/recurring', input({ categoryId: salary }))).status).toBe(400);
    expect((await alice.post('/recurring', input({ categoryId: '999999' }))).status).toBe(404);
    expect(
      (await alice.post('/recurring', input({ type: 'income', categoryId: salary }))).status,
    ).toBe(201);
  });

  it('rejects an archived wallet (409)', async () => {
    const wallet = await createWallet(alice);
    await alice.patch(`/wallets/${wallet.id}`, { isArchived: true }).expect(200);
    expect((await alice.post('/recurring', input({ walletId: wallet.id }))).status).toBe(409);
  });

  it('re-checks the merged record on PATCH', async () => {
    const recurring = await createRecurring(alice, { frequency: 'weekly' });
    // Switching to an income category without changing the type → mismatch
    expect((await alice.patch(`/recurring/${recurring.id}`, { categoryId: salary })).status).toBe(
      400,
    );
    // endDate before the stored nextRunDate
    expect(
      (
        await alice.patch(`/recurring/${recurring.id}`, {
          endDate: addDays(recurring.nextRunDate, -1),
        })
      ).status,
    ).toBe(400);
    expect((await alice.patch(`/recurring/${recurring.id}`, {})).status).toBe(400);
  });

  it('a wallet with recurring cannot be deleted (409)', async () => {
    const wallet = await createWallet(alice);
    await createRecurring(alice, { walletId: wallet.id });
    expect((await alice.delete(`/wallets/${wallet.id}`)).status).toBe(409);
  });
});

describe('recurring data isolation', () => {
  it("never shows, edits or deletes another user's recurring (404)", async () => {
    const secret = await createRecurring(alice);

    const bobList = (await bob.get('/recurring')).body.data as RecurringDto[];
    expect(bobList.map((r) => r.id)).not.toContain(secret.id);
    expect((await bob.patch(`/recurring/${secret.id}`, { amount: '1' })).status).toBe(404);
    expect((await bob.delete(`/recurring/${secret.id}`)).status).toBe(404);
  });

  it("cannot point a recurring at another user's wallet (404)", async () => {
    const res = await bob.post('/recurring', input({ walletId }));
    expect(res.status).toBe(404);
  });
});
