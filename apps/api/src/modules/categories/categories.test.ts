import type { CategoryDto } from '@income-expenses/shared';
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
let food: string; // system "อาหาร"
let coffee: string; // system "กาแฟ" (child of อาหาร)
let salary: string; // system income category

async function createCategory(client: ApiClient, body: object): Promise<CategoryDto> {
  const res = await client.post('/categories', body);
  if (res.status !== 201) throw new Error(JSON.stringify(res.body));
  return (res.body as { data: CategoryDto }).data;
}

beforeAll(async () => {
  await resetDatabase();
  alice = apiClient(app, (await registerUser(app)).accessToken);
  bob = apiClient(app, (await registerUser(app)).accessToken);
  food = await systemCategoryId('อาหาร', 'expense');
  coffee = await systemCategoryId('กาแฟ', 'expense');
  salary = await systemCategoryId('เงินเดือน', 'income');
});

afterAll(async () => {
  await prisma.$disconnect();
});

describe('GET /categories', () => {
  it('returns system categories as a tree (อาหาร > กาแฟ) filtered by type', async () => {
    const res = await alice.get('/categories?type=expense');
    const tree = res.body.data as CategoryDto[];

    expect(tree.every((c) => c.type === 'expense')).toBe(true);
    const foodNode = tree.find((c) => c.id === food);
    expect(foodNode).toMatchObject({ isSystem: true, parentId: null });
    expect(foodNode?.children.map((c) => c.name)).toEqual(['กาแฟ']);
    // Children are nested, not repeated at the root
    expect(tree.find((c) => c.id === coffee)).toBeUndefined();
  });

  it('gives system categories a stable systemKey for translation, and none to own ones', async () => {
    const created = await alice.post('/categories', { name: 'Cat food', type: 'expense' });
    const tree = (await alice.get('/categories?type=expense')).body.data as CategoryDto[];

    const foodNode = tree.find((c) => c.id === food);
    expect(foodNode?.systemKey).toBe('food');
    expect(foodNode?.children[0]?.systemKey).toBe('coffee');
    expect(tree.find((c) => c.id === created.body.data.id)?.systemKey).toBeNull();
  });
});

describe('creating categories (rule 7)', () => {
  it('allows a user sub-category under a system category', async () => {
    const tea = await createCategory(alice, {
      name: 'ชานม',
      type: 'expense',
      parentId: food,
      color: '#a855f7',
    });

    expect(tea).toMatchObject({ parentId: food, isSystem: false, color: '#A855F7' });
    const tree = (await alice.get('/categories?type=expense')).body.data as CategoryDto[];
    expect(tree.find((c) => c.id === food)?.children.map((c) => c.name)).toContain('ชานม');
  });

  it('rejects nesting deeper than one level', async () => {
    const res = await alice.post('/categories', {
      name: 'Latte',
      type: 'expense',
      parentId: coffee,
    });

    expect(res.status).toBe(400);
    expect(res.body.error.details[0].path).toBe('parentId');
  });

  it('rejects a child whose type differs from the parent', async () => {
    await alice.post('/categories', { name: 'โบนัส', type: 'income', parentId: food }).expect(400);
  });
});

describe('system categories are read-only (rule 6)', () => {
  it('returns 403 for PATCH and DELETE', async () => {
    expect((await alice.patch(`/categories/${food}`, { name: 'x' })).status).toBe(403);
    expect((await alice.delete(`/categories/${food}`)).status).toBe(403);
  });
});

describe('deleting categories (rule 6)', () => {
  it('deletes an unused category', async () => {
    const category = await createCategory(alice, { name: 'Temp', type: 'expense' });
    await alice.delete(`/categories/${category.id}`).expect(204);
  });

  it('refuses (409) to delete a category used by a transaction', async () => {
    const category = await createCategory(alice, { name: 'Used', type: 'income' });
    const wallet = await createWallet(alice);
    await createTransaction(alice, {
      type: 'income',
      walletId: wallet.id,
      categoryId: category.id,
      amount: '10',
      occurredAt: new Date().toISOString(),
    });

    expect((await alice.delete(`/categories/${category.id}`)).status).toBe(409);
  });

  it('refuses (409) to delete a parent that still has children', async () => {
    const parent = await createCategory(alice, { name: 'Parent', type: 'expense' });
    await createCategory(alice, { name: 'Child', type: 'expense', parentId: parent.id });

    expect((await alice.delete(`/categories/${parent.id}`)).status).toBe(409);
  });

  it('refuses to turn a category with children into a child', async () => {
    const parent = await createCategory(alice, { name: 'P2', type: 'income' });
    await createCategory(alice, { name: 'C2', type: 'income', parentId: parent.id });

    const res = await alice.patch(`/categories/${parent.id}`, { parentId: salary });
    expect(res.status).toBe(400);
  });
});

describe('categories data isolation', () => {
  it("hides, and refuses to change or use, another user's category (404)", async () => {
    const secret = await createCategory(alice, { name: 'Alice only', type: 'expense' });

    const bobTree = (await bob.get('/categories')).body.data as CategoryDto[];
    const flat = bobTree.flatMap((c) => [c, ...c.children]);
    expect(flat.map((c) => c.id)).not.toContain(secret.id);

    expect((await bob.patch(`/categories/${secret.id}`, { name: 'x' })).status).toBe(404);
    expect((await bob.delete(`/categories/${secret.id}`)).status).toBe(404);
    expect(
      (await bob.post('/categories', { name: 'Sub', type: 'expense', parentId: secret.id })).status,
    ).toBe(404);
  });
});
