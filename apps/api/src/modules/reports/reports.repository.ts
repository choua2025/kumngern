import { Prisma } from '../../generated/prisma/client.js';
import type { Db } from '../../lib/db.js';
import { prisma } from '../../lib/prisma.js';

/**
 * Report scope shared by every query:
 *  - the user's own, non-deleted transactions
 *  - wallets in ONE currency (design-doc D7: no cross-currency sums)
 *  - transfers never count as income or expense
 *  - calendar days/months in the user's timezone (rule 9)
 */
export interface ReportScope {
  userId: bigint;
  timezone: string;
  currencyCode: string;
}

/** Inclusive local date range → SQL condition on t.occurred_at (sargable). */
function occurredBetween(scope: ReportScope, fromDate: string, toDate: string): Prisma.Sql {
  return Prisma.sql`
    t.occurred_at >= (${fromDate}::date::timestamp AT TIME ZONE ${scope.timezone})
    AND t.occurred_at < ((${toDate}::date + 1)::timestamp AT TIME ZONE ${scope.timezone})`;
}

function scopeFilter(scope: ReportScope): Prisma.Sql {
  return Prisma.sql`
    t.user_id = ${scope.userId}
    AND t.deleted_at IS NULL
    AND w.currency_code = ${scope.currencyCode}`;
}

export interface MonthTotalsRow {
  month: string;
  income: Prisma.Decimal;
  expense: Prisma.Decimal;
}

export interface CategoryTotalRow {
  categoryId: bigint;
  name: string;
  systemKey: string | null;
  icon: string | null;
  color: string | null;
  total: Prisma.Decimal;
}

export const reportsRepository = {
  /**
   * Income/expense per month for every month from `firstMonth` to `lastMonth`
   * (both "YYYY-MM-01"). Months without transactions are returned as 0 thanks to
   * generate_series + LEFT JOIN.
   */
  async monthlyTotals(
    scope: ReportScope,
    firstMonth: string,
    lastMonth: string,
    lastDay: string,
    db: Db = prisma,
  ): Promise<MonthTotalsRow[]> {
    const rows = await db.$queryRaw<{ month: string; income: string; expense: string }[]>`
      WITH months AS (
        SELECT generate_series(${firstMonth}::date, ${lastMonth}::date, INTERVAL '1 month')::date AS month
      ),
      totals AS (
        SELECT date_trunc('month', t.occurred_at AT TIME ZONE ${scope.timezone})::date AS month,
               SUM(t.amount) FILTER (WHERE t.type = 'income')  AS income,
               SUM(t.amount) FILTER (WHERE t.type = 'expense') AS expense
        FROM transactions t
        JOIN wallets w ON w.wallet_id = t.wallet_id
        WHERE ${scopeFilter(scope)}
          AND t.type IN ('income', 'expense')
          AND ${occurredBetween(scope, firstMonth, lastDay)}
        GROUP BY 1
      )
      SELECT to_char(months.month, 'YYYY-MM') AS month,
             COALESCE(totals.income, 0)  AS income,
             COALESCE(totals.expense, 0) AS expense
      FROM months
      LEFT JOIN totals USING (month)
      ORDER BY months.month`;

    return rows.map((row) => ({
      month: row.month,
      income: new Prisma.Decimal(row.income),
      expense: new Prisma.Decimal(row.expense),
    }));
  },

  /** Totals per ROOT category: a sub-category's amount is added to its parent. */
  async totalsByRootCategory(
    scope: ReportScope,
    type: 'income' | 'expense',
    fromDate: string,
    toDate: string,
    db: Db = prisma,
  ): Promise<CategoryTotalRow[]> {
    const rows = await db.$queryRaw<
      {
        category_id: bigint;
        name: string;
        system_key: string | null;
        icon: string | null;
        color: string | null;
        total: string;
      }[]
    >`
      SELECT root.category_id, root.name, root.system_key, root.icon, root.color, SUM(t.amount) AS total
      FROM transactions t
      JOIN wallets w       ON w.wallet_id = t.wallet_id
      JOIN categories c    ON c.category_id = t.category_id
      JOIN categories root ON root.category_id = COALESCE(c.parent_id, c.category_id)
      WHERE ${scopeFilter(scope)}
        AND t.type = ${type}
        AND ${occurredBetween(scope, fromDate, toDate)}
      GROUP BY root.category_id, root.name, root.system_key, root.icon, root.color
      ORDER BY total DESC, root.category_id`;

    return rows.map((row) => ({
      categoryId: row.category_id,
      name: row.name,
      systemKey: row.system_key,
      icon: row.icon,
      color: row.color,
      total: new Prisma.Decimal(row.total),
    }));
  },

  /** Expense per local calendar day, one row for EVERY day in the range. */
  async dailyExpenses(
    scope: ReportScope,
    fromDate: string,
    toDate: string,
    db: Db = prisma,
  ): Promise<{ date: string; expense: Prisma.Decimal }[]> {
    const rows = await db.$queryRaw<{ date: string; expense: string }[]>`
      WITH days AS (
        SELECT generate_series(${fromDate}::date, ${toDate}::date, INTERVAL '1 day')::date AS day
      ),
      spent AS (
        SELECT (t.occurred_at AT TIME ZONE ${scope.timezone})::date AS day, SUM(t.amount) AS expense
        FROM transactions t
        JOIN wallets w ON w.wallet_id = t.wallet_id
        WHERE ${scopeFilter(scope)}
          AND t.type = 'expense'
          AND ${occurredBetween(scope, fromDate, toDate)}
        GROUP BY 1
      )
      SELECT to_char(days.day, 'YYYY-MM-DD') AS date, COALESCE(spent.expense, 0) AS expense
      FROM days
      LEFT JOIN spent USING (day)
      ORDER BY days.day`;

    return rows.map((row) => ({ date: row.date, expense: new Prisma.Decimal(row.expense) }));
  },
};

export type ReportsRepository = typeof reportsRepository;
