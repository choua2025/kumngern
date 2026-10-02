import type {
  ByCategoryReportDto,
  CategoryType,
  DailyReportDto,
  MonthTotalsDto,
  SummaryReportDto,
  TrendReportDto,
} from '@income-expenses/shared';
import { Prisma } from '../../generated/prisma/client.js';
import { errors } from '../../lib/errors.js';
import { toMoneyString } from '../../lib/money.js';
import { addMonths, currentMonthIn, firstDayOf, lastDayOf } from '../../lib/month.js';
import { type UsersRepository, usersRepository } from '../users/users.repository.js';
import {
  type MonthTotalsRow,
  type ReportScope,
  type ReportsRepository,
  reportsRepository,
} from './reports.repository.js';

type Decimal = Prisma.Decimal;

function toMonthTotalsDto(row: MonthTotalsRow): MonthTotalsDto {
  return {
    month: row.month,
    income: toMoneyString(row.income),
    expense: toMoneyString(row.expense),
    net: toMoneyString(row.income.minus(row.expense)),
  };
}

/** (current − previous) / |previous| × 100, 1 decimal; null when previous is 0. */
export function percentChange(current: Decimal, previous: Decimal): number | null {
  if (previous.isZero()) {
    return null;
  }
  return current
    .minus(previous)
    .div(previous.abs())
    .mul(100)
    .toDecimalPlaces(1, Prisma.Decimal.ROUND_HALF_UP)
    .toNumber();
}

function percentOf(part: Decimal, total: Decimal): number {
  return total.isZero()
    ? 0
    : part.div(total).mul(100).toDecimalPlaces(1, Prisma.Decimal.ROUND_HALF_UP).toNumber();
}

interface ReportsServiceDeps {
  reports: ReportsRepository;
  users: UsersRepository;
}

export function createReportsService({ reports, users }: ReportsServiceDeps) {
  /** Reports use the user's timezone and default currency (design-doc D7). */
  async function scopeFor(userId: bigint): Promise<ReportScope> {
    const user = await users.findById(userId);
    if (!user) {
      throw errors.unauthorized();
    }
    return { userId, timezone: user.timezone, currencyCode: user.defaultCurrency };
  }

  return {
    async summary(userId: bigint, month: string): Promise<SummaryReportDto> {
      const scope = await scopeFor(userId);
      const previousMonth = addMonths(month, -1);
      const [previous, current] = await reports.monthlyTotals(
        scope,
        firstDayOf(previousMonth),
        firstDayOf(month),
        lastDayOf(month),
      );
      if (!previous || !current) {
        throw new Error('monthlyTotals returned fewer rows than months requested');
      }

      return {
        currencyCode: scope.currencyCode,
        ...toMonthTotalsDto(current),
        previous: toMonthTotalsDto(previous),
        changePercent: {
          income: percentChange(current.income, previous.income),
          expense: percentChange(current.expense, previous.expense),
          net: percentChange(
            current.income.minus(current.expense),
            previous.income.minus(previous.expense),
          ),
        },
      };
    },

    async byCategory(
      userId: bigint,
      query: { from: string; to: string; type: CategoryType },
    ): Promise<ByCategoryReportDto> {
      const scope = await scopeFor(userId);
      const rows = await reports.totalsByRootCategory(scope, query.type, query.from, query.to);
      const total = rows.reduce((sum, row) => sum.plus(row.total), new Prisma.Decimal(0));

      return {
        currencyCode: scope.currencyCode,
        total: toMoneyString(total),
        items: rows.map((row) => ({
          category: {
            id: row.categoryId.toString(),
            name: row.name,
            systemKey: row.systemKey,
            icon: row.icon,
            color: row.color,
          },
          total: toMoneyString(row.total),
          percent: percentOf(row.total, total),
        })),
      };
    },

    /** The last `months` months INCLUDING the current one (in the user's timezone). */
    async trend(userId: bigint, months: number): Promise<TrendReportDto> {
      const scope = await scopeFor(userId);
      const lastMonth = currentMonthIn(scope.timezone);
      const firstMonth = addMonths(lastMonth, -(months - 1));
      const rows = await reports.monthlyTotals(
        scope,
        firstDayOf(firstMonth),
        firstDayOf(lastMonth),
        lastDayOf(lastMonth),
      );
      return { currencyCode: scope.currencyCode, items: rows.map(toMonthTotalsDto) };
    },

    async daily(userId: bigint, month: string): Promise<DailyReportDto> {
      const scope = await scopeFor(userId);
      const rows = await reports.dailyExpenses(scope, firstDayOf(month), lastDayOf(month));
      return {
        currencyCode: scope.currencyCode,
        items: rows.map((row) => ({ date: row.date, expense: toMoneyString(row.expense) })),
      };
    },
  };
}

export type ReportsService = ReturnType<typeof createReportsService>;

export const reportsService = createReportsService({
  reports: reportsRepository,
  users: usersRepository,
});
