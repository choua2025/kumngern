import { Prisma } from '../../generated/prisma/client.js';
import type { Db } from '../../lib/db.js';
import { prisma } from '../../lib/prisma.js';

export interface BudgetWithSpent {
  id: bigint;
  month: Date;
  limitAmount: Prisma.Decimal;
  alertPercent: number;
  spent: Prisma.Decimal;
  currencyCode: string;
  category: {
    id: bigint;
    name: string;
    icon: string | null;
    color: string | null;
    parentId: bigint | null;
  };
}

interface BudgetRow {
  budget_id: bigint;
  month: Date;
  limit_amount: Prisma.Decimal;
  alert_percent: number;
  spent: Prisma.Decimal;
  default_currency: string;
  category_id: bigint;
  category_name: string;
  icon: string | null;
  color: string | null;
  parent_id: bigint | null;
}

export const budgetsRepository = {
  /**
   * Budgets with the amount spent, computed in ONE query:
   *  - rule 8: the budget category OR any of its sub-categories
   *  - design-doc D7: only wallets in the user's default currency
   *  - rule 9: month boundaries in the user's timezone. The right-hand side
   *    `(month::timestamp AT TIME ZONE tz)` is a constant, so occurred_at stays
   *    index-friendly (sargable).
   */
  async findWithSpent(
    userId: bigint,
    filter: { month: string } | { budgetId: bigint },
    db: Db = prisma,
  ): Promise<BudgetWithSpent[]> {
    const where =
      'month' in filter
        ? Prisma.sql`AND b.month = ${filter.month}::date`
        : Prisma.sql`AND b.budget_id = ${filter.budgetId}`;

    const rows = await db.$queryRaw<BudgetRow[]>`
      SELECT b.budget_id, b.month, b.limit_amount, b.alert_percent,
             u.default_currency,
             c.category_id, c.name AS category_name, c.icon, c.color, c.parent_id,
             s.spent
      FROM budgets b
      JOIN users u ON u.user_id = b.user_id
      JOIN categories c ON c.category_id = b.category_id
      CROSS JOIN LATERAL (
        SELECT COALESCE(SUM(t.amount), 0) AS spent
        FROM transactions t
        JOIN wallets w ON w.wallet_id = t.wallet_id
        JOIN categories tc ON tc.category_id = t.category_id
        WHERE t.user_id = b.user_id
          AND t.type = 'expense'
          AND t.deleted_at IS NULL
          AND w.currency_code = u.default_currency
          AND (tc.category_id = b.category_id OR tc.parent_id = b.category_id)
          AND t.occurred_at >= (b.month::timestamp AT TIME ZONE u.timezone)
          AND t.occurred_at <  ((b.month + INTERVAL '1 month')::timestamp AT TIME ZONE u.timezone)
      ) s
      WHERE b.user_id = ${userId}
        ${where}
      ORDER BY c.name, b.budget_id`;

    return rows.map((row) => ({
      id: row.budget_id,
      month: row.month,
      limitAmount: new Prisma.Decimal(row.limit_amount),
      alertPercent: Number(row.alert_percent),
      spent: new Prisma.Decimal(row.spent),
      currencyCode: row.default_currency,
      category: {
        id: row.category_id,
        name: row.category_name,
        icon: row.icon,
        color: row.color,
        parentId: row.parent_id,
      },
    }));
  },

  findByCategoryAndMonth(userId: bigint, categoryId: bigint, month: Date, db: Db = prisma) {
    return db.budget.findFirst({ where: { userId, categoryId, month }, select: { id: true } });
  },

  findManyByMonth(userId: bigint, month: Date, db: Db = prisma) {
    return db.budget.findMany({
      where: { userId, month },
      select: { categoryId: true, limitAmount: true, alertPercent: true },
    });
  },

  async create(
    data: {
      userId: bigint;
      categoryId: bigint;
      month: Date;
      limitAmount: Prisma.Decimal;
      alertPercent: number;
    },
    db: Db = prisma,
  ): Promise<bigint> {
    const budget = await db.budget.create({ data, select: { id: true } });
    return budget.id;
  },

  /** Inserts, silently skipping (user, category, month) combinations that exist already. */
  async createManySkippingExisting(
    rows: {
      userId: bigint;
      categoryId: bigint;
      month: Date;
      limitAmount: Prisma.Decimal;
      alertPercent: number;
    }[],
    db: Db = prisma,
  ): Promise<number> {
    const { count } = await db.budget.createMany({ data: rows, skipDuplicates: true });
    return count;
  },

  async update(
    userId: bigint,
    budgetId: bigint,
    data: { limitAmount?: Prisma.Decimal | undefined; alertPercent?: number | undefined },
    db: Db = prisma,
  ): Promise<boolean> {
    const { count } = await db.budget.updateMany({ where: { id: budgetId, userId }, data });
    return count > 0;
  },

  async delete(userId: bigint, budgetId: bigint, db: Db = prisma): Promise<boolean> {
    const { count } = await db.budget.deleteMany({ where: { id: budgetId, userId } });
    return count > 0;
  },
};

export type BudgetsRepository = typeof budgetsRepository;
