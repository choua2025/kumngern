import { z } from 'zod';
import { BUDGET_DEFAULT_ALERT_PERCENT } from '../constants.js';
import { idSchema, positiveMoneySchema } from './primitives.js';

/** "YYYY-MM" — a calendar month in the user's timezone. */
export const monthSchema = z
  .string({ error: 'กรุณาระบุเดือน' })
  .regex(/^\d{4}-(0[1-9]|1[0-2])$/, 'เดือนต้องเป็นรูปแบบ YYYY-MM');

const alertPercentSchema = z.coerce
  .number({ error: 'เปอร์เซ็นต์แจ้งเตือนต้องเป็นตัวเลข' })
  .int('เปอร์เซ็นต์แจ้งเตือนต้องเป็นจำนวนเต็ม')
  .min(1, 'เปอร์เซ็นต์แจ้งเตือนต้องอยู่ระหว่าง 1-100')
  .max(100, 'เปอร์เซ็นต์แจ้งเตือนต้องอยู่ระหว่าง 1-100');

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
    message: 'ต้องระบุอย่างน้อย 1 ฟิลด์ที่จะแก้ไข',
  });
export type UpdateBudgetData = z.output<typeof updateBudgetSchema>;

export const copyBudgetsSchema = z.object({
  /** Budgets of the month BEFORE this one are copied into it. */
  toMonth: monthSchema,
});
export type CopyBudgetsData = z.output<typeof copyBudgetsSchema>;

export const budgetsQuerySchema = z.object({ month: monthSchema });
