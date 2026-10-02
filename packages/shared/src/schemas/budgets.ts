import { z } from 'zod';
import { msg } from '../messages/index.js';
import { BUDGET_DEFAULT_ALERT_PERCENT } from '../constants.js';
import { idSchema, positiveMoneySchema } from './primitives.js';

/** "YYYY-MM" — a calendar month in the user's timezone. */
export const monthSchema = z
  .string({ error: msg('validation.monthRequired') })
  .regex(/^\d{4}-(0[1-9]|1[0-2])$/, msg('validation.monthInvalid'));

const alertPercentSchema = z.coerce
  .number({ error: msg('validation.alertPercentNumber') })
  .int(msg('validation.alertPercentInteger'))
  .min(1, msg('validation.alertPercentRange'))
  .max(100, msg('validation.alertPercentRange'));

export const createBudgetSchema = z.object({
  categoryId: idSchema,
  month: monthSchema,
  limitAmount: positiveMoneySchema,
  alertPercent: alertPercentSchema.default(BUDGET_DEFAULT_ALERT_PERCENT),
});
export type CreateBudgetInput = z.input<typeof createBudgetSchema>;
export type CreateBudgetData = z.output<typeof createBudgetSchema>;

export const updateBudgetSchema = z
  .object({
    limitAmount: positiveMoneySchema.optional(),
    alertPercent: alertPercentSchema.optional(),
  })
  .refine((value) => Object.values(value).some((field) => field !== undefined), {
    message: msg('validation.atLeastOneField'),
  });
export type UpdateBudgetData = z.output<typeof updateBudgetSchema>;

export const copyBudgetsSchema = z.object({
  /** Budgets of the month BEFORE this one are copied into it. */
  toMonth: monthSchema,
});
export type CopyBudgetsData = z.output<typeof copyBudgetsSchema>;

export const budgetsQuerySchema = z.object({ month: monthSchema });
