import type { BudgetStatus } from '@income-expenses/shared';
import { Prisma } from '../../generated/prisma/client.js';

export interface BudgetEvaluation {
  remaining: Prisma.Decimal;
  /** Rounded to 1 decimal — for display only. */
  usedPercent: number;
  status: BudgetStatus;
}

/**
 * ok      : used < alert%
 * warning : alert% ≤ used ≤ 100%
 * over    : used > 100%
 *
 * The status is decided on the EXACT percentage. Rounding first would show
 * 100.04 % as "100.0 %" with status "warning" although the budget is exceeded.
 */
export function evaluateBudget(
  limitAmount: Prisma.Decimal,
  spent: Prisma.Decimal,
  alertPercent: number,
): BudgetEvaluation {
  const used = spent.div(limitAmount).mul(100);

  let status: BudgetStatus = 'ok';
  if (used.gt(100)) {
    status = 'over';
  } else if (used.gte(alertPercent)) {
    status = 'warning';
  }

  return {
    remaining: limitAmount.minus(spent),
    usedPercent: used.toDecimalPlaces(1, Prisma.Decimal.ROUND_HALF_UP).toNumber(),
    status,
  };
}
