import type {
  BudgetDto,
  CopyBudgetsData,
  CopyBudgetsResultDto,
  CreateBudgetData,
  UpdateBudgetData,
} from '@income-expenses/shared';
import { runInTransaction, type TransactionRunner } from '../../lib/db.js';
import { detail, errors } from '../../lib/errors.js';
import { toDecimal, toMoneyString } from '../../lib/money.js';
import { addMonths, firstDayOf, monthOf, monthToDate } from '../../lib/month.js';
import {
  type CategoriesRepository,
  categoriesRepository,
} from '../categories/categories.repository.js';
import { evaluateBudget } from './budget-status.js';
import {
  type BudgetsRepository,
  type BudgetWithSpent,
  budgetsRepository,
} from './budgets.repository.js';

const BUDGET_NOT_FOUND = 'errors.budgetNotFound';

export function toBudgetDto(budget: BudgetWithSpent): BudgetDto {
  const { remaining, usedPercent, status } = evaluateBudget(
    budget.limitAmount,
    budget.spent,
    budget.alertPercent,
  );
  return {
    id: budget.id.toString(),
    month: monthOf(budget.month),
    category: {
      id: budget.category.id.toString(),
      name: budget.category.name,
      systemKey: budget.category.systemKey,
      icon: budget.category.icon,
      color: budget.category.color,
      parentId: budget.category.parentId?.toString() ?? null,
    },
    limitAmount: toMoneyString(budget.limitAmount),
    alertPercent: budget.alertPercent,
    spent: toMoneyString(budget.spent),
    remaining: toMoneyString(remaining),
    usedPercent,
    status,
    currencyCode: budget.currencyCode,
  };
}

interface BudgetsServiceDeps {
  budgets: BudgetsRepository;
  categories: CategoriesRepository;
  transaction: TransactionRunner;
}

export function createBudgetsService({ budgets, categories, transaction }: BudgetsServiceDeps) {
  async function getOrThrow(userId: bigint, budgetId: bigint): Promise<BudgetDto> {
    const [budget] = await budgets.findWithSpent(userId, { budgetId });
    if (!budget) {
      throw errors.notFound(BUDGET_NOT_FOUND);
    }
    return toBudgetDto(budget);
  }

  return {
    async list(userId: bigint, month: string): Promise<BudgetDto[]> {
      const rows = await budgets.findWithSpent(userId, { month: firstDayOf(month) });
      return rows.map(toBudgetDto);
    },

    async create(userId: bigint, input: CreateBudgetData): Promise<BudgetDto> {
      const categoryId = BigInt(input.categoryId);
      const category = await categories.findVisibleById(userId, categoryId);
      if (!category) {
        throw errors.notFound('errors.categoryNotFound');
      }
      if (category.type !== 'expense') {
        throw errors.validation(undefined, [detail('categoryId', 'validation.budgetExpenseOnly')]);
      }
      const month = monthToDate(input.month);
      if (await budgets.findByCategoryAndMonth(userId, categoryId, month)) {
        throw errors.conflict('errors.budgetDuplicate');
      }
      // A concurrent duplicate still hits uq_budgets_user_category_month → 409.
      const budgetId = await budgets.create({
        userId,
        categoryId,
        month,
        limitAmount: toDecimal(input.limitAmount),
        alertPercent: input.alertPercent,
      });
      return getOrThrow(userId, budgetId);
    },

    /** Copies last month's budgets into `toMonth`; categories that already have one are skipped. */
    async copyFromPreviousMonth(
      userId: bigint,
      input: CopyBudgetsData,
    ): Promise<CopyBudgetsResultDto> {
      const target = monthToDate(input.toMonth);
      const source = monthToDate(addMonths(input.toMonth, -1));

      return transaction(async (tx) => {
        const previous = await budgets.findManyByMonth(userId, source, tx);
        const copied = await budgets.createManySkippingExisting(
          previous.map((budget) => ({
            userId,
            categoryId: budget.categoryId,
            month: target,
            limitAmount: budget.limitAmount,
            alertPercent: budget.alertPercent,
          })),
          tx,
        );
        return { copied, skipped: previous.length - copied };
      });
    },

    async update(userId: bigint, budgetId: bigint, input: UpdateBudgetData): Promise<BudgetDto> {
      const updated = await budgets.update(userId, budgetId, {
        limitAmount: input.limitAmount === undefined ? undefined : toDecimal(input.limitAmount),
        alertPercent: input.alertPercent,
      });
      if (!updated) {
        throw errors.notFound(BUDGET_NOT_FOUND);
      }
      return getOrThrow(userId, budgetId);
    },

    async delete(userId: bigint, budgetId: bigint): Promise<void> {
      if (!(await budgets.delete(userId, budgetId))) {
        throw errors.notFound(BUDGET_NOT_FOUND);
      }
    },
  };
}

export type BudgetsService = ReturnType<typeof createBudgetsService>;

export const budgetsService = createBudgetsService({
  budgets: budgetsRepository,
  categories: categoriesRepository,
  transaction: runInTransaction,
});
