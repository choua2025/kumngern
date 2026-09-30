/**
 * Seed data (spec 5.5).
 *
 * - Idempotent: currencies and system categories are upserted; demo users are deleted
 *   (ON DELETE CASCADE removes all their data) and recreated.
 * - Deterministic: a seeded PRNG instead of Math.random(), so running it twice on the
 *   same day produces identical data. Dates are relative to "today" in the user's timezone.
 * - Money never touches floating point: random amounts are integer minor units that are
 *   converted to Prisma.Decimal immediately.
 */
import path from 'node:path';
import { PrismaPg } from '@prisma/adapter-pg';
import bcrypt from 'bcrypt';
import { config as loadEnv } from 'dotenv';
import { Prisma, PrismaClient } from '../src/generated/prisma/client.js';

loadEnv({ path: path.resolve(import.meta.dirname, '../../../.env'), quiet: true });

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  throw new Error('DATABASE_URL is not set');
}

const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: databaseUrl }) });

const Decimal = Prisma.Decimal;
type Decimal = Prisma.Decimal;

const DEMO_PASSWORD = 'Password123!';
const BCRYPT_COST = 12;
const PRNG_SEED = 20260930;

// ---------------------------------------------------------------------------
// Reference data
// ---------------------------------------------------------------------------

const CURRENCIES = [
  { code: 'THB', name: 'Thai Baht', symbol: '฿', decimals: 2 },
  { code: 'USD', name: 'US Dollar', symbol: '$', decimals: 2 },
  { code: 'LAK', name: 'Lao Kip', symbol: '₭', decimals: 0 },
] as const;

type CategoryType = 'income' | 'expense';

interface CategorySeed {
  key: string;
  name: string;
  type: CategoryType;
  icon: string;
  color: string;
  children?: CategorySeed[];
}

const SYSTEM_CATEGORIES: CategorySeed[] = [
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

type CategoryKey =
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

type CategoryIds = Record<CategoryKey, bigint>;

// ---------------------------------------------------------------------------
// Demo users
// ---------------------------------------------------------------------------

type WalletKey = 'bank' | 'cash' | 'third';

interface WalletSeed {
  key: WalletKey;
  name: string;
  type: 'cash' | 'bank' | 'ewallet' | 'credit_card' | 'saving';
  currencyCode: string;
  initialBalance: string;
}

interface DemoUserSeed {
  email: string;
  displayName: string;
  defaultCurrency: string;
  timezone: string;
  /** Fixed UTC offset of the timezone (both demo timezones have no DST). */
  utcOffset: string;
  /** Converts a THB-denominated price range into this user's currency. */
  thbRate: number;
  /** Amounts are rounded to a multiple of this many minor units. */
  roundingMinorUnits: number;
  /** Budget limits are rounded to a multiple of this amount. */
  budgetUnit: string;
  wallets: [WalletSeed, WalletSeed, WalletSeed];
  /** Monthly transfer into the third wallet (to_amount set when currencies differ). */
  thirdWalletTransfer: { amount: string; toAmount: string | null };
}

const DEMO_USERS: DemoUserSeed[] = [
  {
    email: 'demo1@example.com',
    displayName: 'Demo One',
    defaultCurrency: 'THB',
    timezone: 'Asia/Bangkok',
    utcOffset: '+07:00',
    thbRate: 1,
    roundingMinorUnits: 25, // 0.25 THB steps, e.g. 65.50
    budgetUnit: '1',
    wallets: [
      {
        key: 'bank',
        name: 'กสิกร ออมทรัพย์',
        type: 'bank',
        currencyCode: 'THB',
        initialBalance: '15000.00',
      },
      { key: 'cash', name: 'เงินสด', type: 'cash', currencyCode: 'THB', initialBalance: '2000.00' },
      {
        key: 'third',
        name: 'TrueMoney',
        type: 'ewallet',
        currencyCode: 'THB',
        initialBalance: '500.00',
      },
    ],
    thirdWalletTransfer: { amount: '3000.00', toAmount: null },
  },
  {
    email: 'demo2@example.com',
    displayName: 'Demo Two',
    defaultCurrency: 'LAK',
    timezone: 'Asia/Vientiane',
    utcOffset: '+07:00',
    thbRate: 650,
    roundingMinorUnits: 100_000, // 1,000 LAK steps
    budgetUnit: '1000',
    wallets: [
      {
        key: 'bank',
        name: 'BCEL One',
        type: 'bank',
        currencyCode: 'LAK',
        initialBalance: '5000000.00',
      },
      {
        key: 'cash',
        name: 'เงินสด',
        type: 'cash',
        currencyCode: 'LAK',
        initialBalance: '800000.00',
      },
      {
        key: 'third',
        name: 'USD Saving',
        type: 'saving',
        currencyCode: 'USD',
        initialBalance: '200.00',
      },
    ],
    // Cross-currency transfer: 2,000,000 LAK leaves the bank, 92.50 USD arrives.
    thirdWalletTransfer: { amount: '2000000.00', toAmount: '92.50' },
  },
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** mulberry32 — tiny deterministic PRNG returning floats in [0, 1). */
function createRandom(seed: number): () => number {
  let state = seed;
  return () => {
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

type Random = () => number;

function randomInt(random: Random, min: number, max: number): number {
  return min + Math.floor(random() * (max - min + 1));
}

function pick<T>(random: Random, items: readonly T[]): T {
  const item = items[Math.floor(random() * items.length)];
  if (item === undefined) {
    throw new Error('pick() called with an empty list');
  }
  return item;
}

interface LocalDate {
  year: number;
  month: number; // 1-12
  day: number;
}

function todayIn(timezone: string): LocalDate {
  // en-CA formats as YYYY-MM-DD
  const formatted = new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
  const [year, month, day] = formatted.split('-').map(Number);
  if (year === undefined || month === undefined || day === undefined) {
    throw new Error(`Unexpected date format: ${formatted}`);
  }
  return { year, month, day };
}

function shiftMonth(year: number, month: number, delta: number): { year: number; month: number } {
  const index = year * 12 + (month - 1) + delta;
  return { year: Math.floor(index / 12), month: (index % 12) + 1 };
}

function daysInMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

const pad = (value: number): string => String(value).padStart(2, '0');

/** Local wall-clock time in the user's timezone → absolute instant. */
function localDateTime(date: LocalDate, hour: number, minute: number, utcOffset: string): Date {
  return new Date(
    `${date.year}-${pad(date.month)}-${pad(date.day)}T${pad(hour)}:${pad(minute)}:00${utcOffset}`,
  );
}

/** First day of a month as a DATE value (budgets.month). */
function monthDate(year: number, month: number): Date {
  return new Date(`${year}-${pad(month)}-01T00:00:00Z`);
}

/** Random amount for a THB price range, converted to the user's currency. */
function randomAmount(random: Random, user: DemoUserSeed, minThb: number, maxThb: number): Decimal {
  const minMinor = Math.round(minThb * user.thbRate * 100);
  const maxMinor = Math.round(maxThb * user.thbRate * 100);
  const steps = Math.floor((maxMinor - minMinor) / user.roundingMinorUnits);
  const minor = minMinor + randomInt(random, 0, steps) * user.roundingMinorUnits;
  const rounded = Math.max(
    user.roundingMinorUnits,
    Math.round(minor / user.roundingMinorUnits) * user.roundingMinorUnits,
  );
  return new Decimal(rounded).div(100);
}

function fixedAmount(user: DemoUserSeed, thb: number): Decimal {
  const minor =
    Math.round((thb * user.thbRate * 100) / user.roundingMinorUnits) * user.roundingMinorUnits;
  return new Decimal(minor).div(100);
}

// ---------------------------------------------------------------------------
// Seeding steps
// ---------------------------------------------------------------------------

async function seedCurrencies(): Promise<void> {
  for (const currency of CURRENCIES) {
    await prisma.currency.upsert({
      where: { code: currency.code },
      create: currency,
      update: { name: currency.name, symbol: currency.symbol, decimals: currency.decimals },
    });
  }
}

async function upsertSystemCategory(seed: CategorySeed, parentId: bigint | null): Promise<bigint> {
  // System categories have user_id NULL, so there is no unique key to upsert on.
  const existing = await prisma.category.findFirst({
    where: { userId: null, parentId, name: seed.name, type: seed.type },
    select: { id: true },
  });
  if (existing) {
    await prisma.category.update({
      where: { id: existing.id },
      data: { icon: seed.icon, color: seed.color },
    });
    return existing.id;
  }
  const created = await prisma.category.create({
    data: { name: seed.name, type: seed.type, icon: seed.icon, color: seed.color, parentId },
    select: { id: true },
  });
  return created.id;
}

async function seedSystemCategories(): Promise<CategoryIds> {
  const ids: Partial<CategoryIds> = {};
  for (const root of SYSTEM_CATEGORIES) {
    const rootId = await upsertSystemCategory(root, null);
    ids[root.key as CategoryKey] = rootId;
    for (const child of root.children ?? []) {
      ids[child.key as CategoryKey] = await upsertSystemCategory(child, rootId);
    }
  }
  for (const key of Object.keys(ids)) {
    if (ids[key as CategoryKey] === undefined) {
      throw new Error(`Missing category id for ${key}`);
    }
  }
  return ids as CategoryIds;
}

interface PlannedTransaction {
  type: 'income' | 'expense' | 'transfer';
  wallet: WalletKey;
  toWallet?: WalletKey;
  category?: CategoryKey;
  amount: Decimal;
  toAmount?: Decimal;
  note: string | null;
  occurredAt: Date;
}

/** Random expense templates: category, THB price range, preferred wallets, notes. */
const EXPENSE_TEMPLATES: {
  category: CategoryKey;
  minThb: number;
  maxThb: number;
  wallets: WalletKey[];
  notes: string[];
  weight: number;
}[] = [
  {
    category: 'food',
    minThb: 50,
    maxThb: 250,
    wallets: ['cash', 'cash', 'third'],
    notes: ['ข้าวมันไก่', 'ก๋วยเตี๋ยว', 'ข้าวกะเพรา', 'ส้มตำ', 'หมูกระทะ'],
    weight: 6,
  },
  {
    category: 'coffee',
    minThb: 45,
    maxThb: 120,
    wallets: ['cash', 'third'],
    notes: ['Americano', 'Latte', 'ชาเย็น', 'Cappuccino'],
    weight: 4,
  },
  {
    category: 'travel',
    minThb: 20,
    maxThb: 300,
    wallets: ['third', 'cash'],
    notes: ['BTS', 'Grab', 'วินมอเตอร์ไซค์', 'เติมน้ำมัน'],
    weight: 3,
  },
  {
    category: 'shopping',
    minThb: 150,
    maxThb: 2500,
    wallets: ['bank', 'bank', 'third'],
    notes: ['Shopee', 'Lazada', 'เสื้อผ้า', 'ของใช้ในบ้าน'],
    weight: 2,
  },
  {
    category: 'health',
    minThb: 100,
    maxThb: 1500,
    wallets: ['bank', 'cash'],
    notes: ['ร้านยา', 'หาหมอฟัน', 'วิตามิน'],
    weight: 1,
  },
  {
    category: 'entertainment',
    minThb: 150,
    maxThb: 800,
    wallets: ['bank'],
    notes: ['ดูหนัง', 'Netflix', 'คอนเสิร์ต', 'เกม'],
    weight: 1,
  },
  {
    category: 'education',
    minThb: 200,
    maxThb: 1500,
    wallets: ['bank'],
    notes: ['หนังสือ', 'คอร์สออนไลน์'],
    weight: 1,
  },
];

const WEIGHTED_TEMPLATES = EXPENSE_TEMPLATES.flatMap((template) =>
  Array.from({ length: template.weight }, () => template),
);

function planMonth(
  random: Random,
  user: DemoUserSeed,
  year: number,
  month: number,
  lastDay: number,
): PlannedTransaction[] {
  const at = (day: number, hour: number, minute: number): Date =>
    localDateTime({ year, month, day: Math.min(day, lastDay) }, hour, minute, user.utcOffset);

  const thirdTransfer = user.thirdWalletTransfer;

  // Day-to-day spending comes from wallets in the user's default currency only: a LAK
  // price must never be booked against the USD saving wallet.
  const spendFrom = (key: WalletKey): WalletKey =>
    user.wallets.find((wallet) => wallet.key === key)?.currencyCode === user.defaultCurrency
      ? key
      : 'cash';

  // Fixed items every month (also guarantee food/travel spending for the budgets).
  const planned: PlannedTransaction[] = [
    {
      type: 'income',
      wallet: 'bank',
      category: 'salary',
      amount: fixedAmount(user, 35000),
      note: 'เงินเดือน',
      occurredAt: at(1, 9, 0),
    },
    {
      type: 'expense',
      wallet: 'bank',
      category: 'housing',
      amount: fixedAmount(user, 5500),
      note: 'ค่าเช่าห้อง',
      occurredAt: at(1, 10, 0),
    },
    {
      type: 'transfer',
      wallet: 'bank',
      toWallet: 'cash',
      amount: fixedAmount(user, 3000),
      note: 'ถอนเงิน ATM',
      occurredAt: at(2, 12, 15),
    },
    {
      type: 'transfer',
      wallet: 'bank',
      toWallet: 'third',
      amount: new Decimal(thirdTransfer.amount),
      ...(thirdTransfer.toAmount === null ? {} : { toAmount: new Decimal(thirdTransfer.toAmount) }),
      note:
        user.wallets[2].currencyCode === user.defaultCurrency ? 'เติมเงิน e-wallet' : 'แลกเงินเก็บ',
      occurredAt: at(3, 18, 30),
    },
    {
      type: 'expense',
      wallet: 'bank',
      category: 'bills',
      amount: randomAmount(random, user, 800, 1800),
      note: 'ค่าไฟ + ค่าน้ำ',
      occurredAt: at(5, 20, 0),
    },
    {
      type: 'expense',
      wallet: 'cash',
      category: 'food',
      amount: randomAmount(random, user, 60, 200),
      note: 'ข้าวเที่ยง',
      occurredAt: at(1, 12, 30),
    },
    {
      type: 'expense',
      wallet: spendFrom('third'),
      category: 'travel',
      amount: randomAmount(random, user, 40, 250),
      note: 'Grab',
      occurredAt: at(1, 8, 10),
    },
  ];

  const total = randomInt(random, 20, 30);
  while (planned.length < total) {
    const day = randomInt(random, 1, lastDay);
    const hour = randomInt(random, 7, 22);
    const minute = randomInt(random, 0, 59);

    // ~1 in 12 random items is freelance income.
    if (random() < 1 / 12) {
      planned.push({
        type: 'income',
        wallet: 'bank',
        category: 'freelance',
        amount: randomAmount(random, user, 2000, 8000),
        note: 'งานฟรีแลนซ์',
        occurredAt: at(day, hour, minute),
      });
      continue;
    }

    const template = pick(random, WEIGHTED_TEMPLATES);
    planned.push({
      type: 'expense',
      wallet: spendFrom(pick(random, template.wallets)),
      category: template.category,
      amount: randomAmount(random, user, template.minThb, template.maxThb),
      note: pick(random, template.notes),
      occurredAt: at(day, hour, minute),
    });
  }

  return planned;
}

interface BudgetPlan {
  category: CategoryKey;
  status: 'over' | 'warning' | 'ok';
}

const BUDGET_PLANS: BudgetPlan[] = [
  { category: 'food', status: 'over' },
  { category: 'travel', status: 'warning' },
  { category: 'shopping', status: 'ok' },
];

/** Budget spent = expenses in default-currency wallets, category OR its children (rule 8, D7). */
function spentInCategory(
  planned: PlannedTransaction[],
  user: DemoUserSeed,
  budgetCategory: CategoryKey,
): Decimal {
  const matches = (category: CategoryKey | undefined): boolean =>
    category === budgetCategory ||
    SYSTEM_CATEGORIES.some(
      (root) =>
        root.key === budgetCategory &&
        (root.children ?? []).some((child) => child.key === category),
    );
  const currencyOf = (key: WalletKey): string =>
    user.wallets.find((wallet) => wallet.key === key)?.currencyCode ?? '';

  return planned
    .filter(
      (tx) =>
        tx.type === 'expense' &&
        matches(tx.category) &&
        currencyOf(tx.wallet) === user.defaultCurrency,
    )
    .reduce((sum, tx) => sum.plus(tx.amount), new Decimal(0));
}

/** Picks a limit so the budget lands in the wanted status regardless of the random data. */
function limitFor(spent: Decimal, status: BudgetPlan['status'], user: DemoUserSeed): Decimal {
  const unit = new Decimal(user.budgetUnit);
  switch (status) {
    case 'over': // 80% of spent → usedPercent ≈ 125%
      return Decimal.max(spent.mul('0.8').div(unit).floor().mul(unit), unit);
    case 'warning': // spent / 0.9 → usedPercent ≈ 90% (alert at 80%)
      return spent.div('0.9').div(unit).ceil().mul(unit);
    case 'ok': // plenty of room
      return spent.mul(2).plus(fixedAmount(user, 1000)).div(unit).ceil().mul(unit);
  }
}

async function seedDemoUser(
  user: DemoUserSeed,
  categories: CategoryIds,
  passwordHash: string,
  random: Random,
): Promise<void> {
  const today = todayIn(user.timezone);

  // Plan 3 months: two full previous months + the current month up to today.
  const months = [-2, -1, 0].map((delta) => {
    const { year, month } = shiftMonth(today.year, today.month, delta);
    const lastDay = delta === 0 ? today.day : daysInMonth(year, month);
    return { year, month, planned: planMonth(random, user, year, month, lastDay) };
  });
  const currentMonth = months[2];
  if (!currentMonth) {
    throw new Error('Current month missing');
  }

  // All writes for one user in a single database transaction (engineering rule 3).
  await prisma.$transaction(
    async (tx) => {
      const created = await tx.user.create({
        data: {
          email: user.email,
          passwordHash,
          displayName: user.displayName,
          defaultCurrency: user.defaultCurrency,
          timezone: user.timezone,
        },
        select: { id: true },
      });

      const walletIds = {} as Record<WalletKey, bigint>;
      for (const wallet of user.wallets) {
        const createdWallet = await tx.wallet.create({
          data: {
            userId: created.id,
            name: wallet.name,
            type: wallet.type,
            currencyCode: wallet.currencyCode,
            initialBalance: new Decimal(wallet.initialBalance),
          },
          select: { id: true },
        });
        walletIds[wallet.key] = createdWallet.id;
      }

      await tx.transaction.createMany({
        data: months.flatMap(({ planned }) =>
          planned.map((item) => ({
            userId: created.id,
            type: item.type,
            walletId: walletIds[item.wallet],
            toWalletId: item.toWallet ? walletIds[item.toWallet] : null,
            categoryId: item.category ? categories[item.category] : null,
            amount: item.amount,
            toAmount: item.toAmount ?? null,
            note: item.note,
            occurredAt: item.occurredAt,
          })),
        ),
      });

      await tx.budget.createMany({
        data: BUDGET_PLANS.map((plan) => {
          const spent = spentInCategory(currentMonth.planned, user, plan.category);
          return {
            userId: created.id,
            categoryId: categories[plan.category],
            month: monthDate(currentMonth.year, currentMonth.month),
            limitAmount: limitFor(spent, plan.status, user),
            alertPercent: 80,
          };
        }),
      });
    },
    { timeout: 30_000 },
  );

  const count = months.reduce((sum, m) => sum + m.planned.length, 0);
  // eslint-disable-next-line no-console -- CLI script output
  console.log(`  ✔ ${user.email}: 3 wallets, ${count} transactions, 3 budgets`);
}

async function main(): Promise<void> {
  // eslint-disable-next-line no-console -- CLI script output
  console.log('🌱 Seeding...');
  await seedCurrencies();
  const categories = await seedSystemCategories();

  await prisma.user.deleteMany({ where: { email: { in: DEMO_USERS.map((u) => u.email) } } });

  const random = createRandom(PRNG_SEED);
  for (const user of DEMO_USERS) {
    // Hash outside the DB transaction: bcrypt is slow (~250 ms) and would hold the connection.
    const passwordHash = await bcrypt.hash(DEMO_PASSWORD, BCRYPT_COST);
    await seedDemoUser(user, categories, passwordHash, random);
  }
  // eslint-disable-next-line no-console -- CLI script output
  console.log(`🌱 Done. Login with demo1@example.com / ${DEMO_PASSWORD}`);
}

main()
  .catch((error: unknown) => {
    // eslint-disable-next-line no-console -- CLI script output
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => {
    void prisma.$disconnect();
  });
