/**
 * Reference data every environment needs: currencies and system categories.
 * Used by the seed script and by the integration-test global setup.
 * Idempotent — safe to run on every deploy/test run.
 */
import type { PrismaClient } from '../src/generated/prisma/client.js';

export const CURRENCIES = [
  { code: 'THB', name: 'Thai Baht', symbol: '฿', decimals: 2 },
  { code: 'USD', name: 'US Dollar', symbol: '$', decimals: 2 },
  { code: 'LAK', name: 'Lao Kip', symbol: '₭', decimals: 0 },
] as const;

export type CategoryKey =
  | 'salary'
  | 'freelance'
  | 'gift'
  | 'incomeOther'
  | 'food'
  | 'coffee'
  | 'travel'
  | 'housing'
  | 'bills'
  | 'shopping'
  | 'health'
  | 'entertainment'
  | 'education'
  | 'expenseOther';

export type CategoryIds = Record<CategoryKey, bigint>;

export interface CategorySeed {
  key: CategoryKey;
  name: string;
  type: 'income' | 'expense';
  icon: string;
  color: string;
  children?: CategorySeed[];
}

export const SYSTEM_CATEGORIES: CategorySeed[] = [
  { key: 'salary', name: 'เงินเดือน', type: 'income', icon: 'briefcase', color: '#16A34A' },
  { key: 'freelance', name: 'ฟรีแลนซ์', type: 'income', icon: 'laptop', color: '#0D9488' },
  { key: 'gift', name: 'ของขวัญ', type: 'income', icon: 'gift', color: '#DB2777' },
  { key: 'incomeOther', name: 'อื่นๆ', type: 'income', icon: 'circle-plus', color: '#64748B' },
  {
    key: 'food',
    name: 'อาหาร',
    type: 'expense',
    icon: 'utensils',
    color: '#F97316',
    children: [{ key: 'coffee', name: 'กาแฟ', type: 'expense', icon: 'coffee', color: '#92400E' }],
  },
  { key: 'travel', name: 'เดินทาง', type: 'expense', icon: 'bus', color: '#0EA5E9' },
  { key: 'housing', name: 'ที่พัก', type: 'expense', icon: 'home', color: '#6366F1' },
  { key: 'bills', name: 'บิล/ค่าน้ำไฟ', type: 'expense', icon: 'receipt', color: '#EAB308' },
  { key: 'shopping', name: 'ช้อปปิ้ง', type: 'expense', icon: 'shopping-bag', color: '#EC4899' },
  { key: 'health', name: 'สุขภาพ', type: 'expense', icon: 'heart-pulse', color: '#EF4444' },
  {
    key: 'entertainment',
    name: 'บันเทิง',
    type: 'expense',
    icon: 'clapperboard',
    color: '#8B5CF6',
  },
  { key: 'education', name: 'การศึกษา', type: 'expense', icon: 'graduation-cap', color: '#2563EB' },
  {
    key: 'expenseOther',
    name: 'อื่นๆ',
    type: 'expense',
    icon: 'circle-ellipsis',
    color: '#64748B',
  },
];

async function seedCurrencies(prisma: PrismaClient): Promise<void> {
  for (const currency of CURRENCIES) {
    await prisma.currency.upsert({
      where: { code: currency.code },
      create: currency,
      update: { name: currency.name, symbol: currency.symbol, decimals: currency.decimals },
    });
  }
}

async function upsertSystemCategory(
  prisma: PrismaClient,
  seed: CategorySeed,
  parentId: bigint | null,
): Promise<bigint> {
  // By system_key (unique) first; by name for rows seeded before system_key existed —
  // the update then fills the key in, so running this again is always safe.
  const existing =
    (await prisma.category.findUnique({ where: { systemKey: seed.key }, select: { id: true } })) ??
    (await prisma.category.findFirst({
      where: { userId: null, parentId, name: seed.name, type: seed.type },
      select: { id: true },
    }));
  if (existing) {
    await prisma.category.update({
      where: { id: existing.id },
      data: { icon: seed.icon, color: seed.color, systemKey: seed.key },
    });
    return existing.id;
  }
  const created = await prisma.category.create({
    data: {
      name: seed.name,
      type: seed.type,
      icon: seed.icon,
      color: seed.color,
      parentId,
      systemKey: seed.key,
    },
    select: { id: true },
  });
  return created.id;
}

async function seedSystemCategories(prisma: PrismaClient): Promise<CategoryIds> {
  const ids = new Map<CategoryKey, bigint>();
  for (const root of SYSTEM_CATEGORIES) {
    const rootId = await upsertSystemCategory(prisma, root, null);
    ids.set(root.key, rootId);
    for (const child of root.children ?? []) {
      ids.set(child.key, await upsertSystemCategory(prisma, child, rootId));
    }
  }

  const expectedKeys = SYSTEM_CATEGORIES.flatMap((root) => [
    root.key,
    ...(root.children ?? []).map((child) => child.key),
  ]);
  const missing = expectedKeys.filter((key) => !ids.has(key));
  if (missing.length > 0) {
    throw new Error(`Missing category ids for: ${missing.join(', ')}`);
  }
  return Object.fromEntries(ids) as CategoryIds;
}

export async function seedReferenceData(prisma: PrismaClient): Promise<CategoryIds> {
  await seedCurrencies(prisma);
  return seedSystemCategories(prisma);
}
