import type { TagRefDto, TransactionDto } from '@income-expenses/shared';
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

async function createTag(client: ApiClient, name: string): Promise<TagRefDto> {
  const res = await client.post('/tags', { name });
  if (res.status !== 201) throw new Error(JSON.stringify(res.body));
  return (res.body as { data: TagRefDto }).data;
}

beforeAll(async () => {
  await resetDatabase();
  alice = apiClient(app, (await registerUser(app)).accessToken);
  bob = apiClient(app, (await registerUser(app)).accessToken);
  food = await systemCategoryId('อาหาร', 'expense');
});

afterAll(async () => {
  await prisma.$disconnect();
});

describe('tags CRUD', () => {
  it('creates, lists (sorted by name), renames and deletes', async () => {
    await createTag(alice, 'ทริปญี่ปุ่น');
    const client = await createTag(alice, '  ลูกค้า A  ');
    expect(client.name).toBe('ลูกค้า A'); // trimmed

    const list = (await alice.get('/tags')).body.data as TagRefDto[];
    expect(list.map((t) => t.name)).toEqual(['ทริปญี่ปุ่น', 'ลูกค้า A']);

    const renamed = await alice.patch(`/tags/${client.id}`, { name: 'ลูกค้า B' });
    expect(renamed.status).toBe(200);
    expect(renamed.body.data.name).toBe('ลูกค้า B');

    await alice.delete(`/tags/${client.id}`).expect(204);
    await alice.delete(`/tags/${client.id}`).expect(404);
  });

  it('rejects duplicate and empty names', async () => {
    await createTag(alice, 'dup');
    const other = await createTag(alice, 'other');

    expect((await alice.post('/tags', { name: 'dup' })).status).toBe(409);
    expect((await alice.patch(`/tags/${other.id}`, { name: 'dup' })).status).toBe(409);
    expect((await alice.post('/tags', { name: '   ' })).status).toBe(400);
    expect((await alice.post('/tags', { name: 'x'.repeat(51) })).status).toBe(400);
    // Another user may use the same name
    expect((await bob.post('/tags', { name: 'dup' })).status).toBe(201);
  });

  it('deleting a tag keeps the transactions but removes the link', async () => {
    const wallet = await createWallet(alice);
    const tag = await createTag(alice, 'to-delete');
    const tx = await createTransaction(alice, {
      type: 'expense',
      walletId: wallet.id,
      categoryId: food,
      amount: '10',
      occurredAt: new Date().toISOString(),
      tagIds: [tag.id],
    });
    expect(tx.tags.map((t) => t.name)).toEqual(['to-delete']);

    await alice.delete(`/tags/${tag.id}`).expect(204);

    const after = (await alice.get(`/transactions/${tx.id}`)).body.data as TransactionDto;
    expect(after.tags).toEqual([]);
  });

  it('filters transactions by tag', async () => {
    const wallet = await createWallet(alice);
    const trip = await createTag(alice, 'trip');
    const tagged = await createTransaction(alice, {
      type: 'expense',
      walletId: wallet.id,
      categoryId: food,
      amount: '1',
      occurredAt: new Date().toISOString(),
      tagIds: [trip.id],
    });
    await createTransaction(alice, {
      type: 'expense',
      walletId: wallet.id,
      categoryId: food,
      amount: '2',
      occurredAt: new Date().toISOString(),
    });

    const res = await alice.get(`/transactions?tagId=${trip.id}`);
    expect((res.body.data as TransactionDto[]).map((t) => t.id)).toEqual([tagged.id]);
  });
});

describe('tags data isolation', () => {
  it("never shows, renames or deletes another user's tag (404)", async () => {
    const secret = await createTag(alice, 'alice-secret');

    expect(((await bob.get('/tags')).body.data as TagRefDto[]).map((t) => t.id)).not.toContain(
      secret.id,
    );
    expect((await bob.patch(`/tags/${secret.id}`, { name: 'x' })).status).toBe(404);
    expect((await bob.delete(`/tags/${secret.id}`)).status).toBe(404);
  });
});
