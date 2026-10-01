import { z } from 'zod';
import { CATEGORY_TYPES, RECURRING_FREQUENCIES } from '../constants.js';
import { idSchema, localDateSchema, optionalText, positiveMoneySchema } from './primitives.js';

/** Last day-of-month a monthly/yearly recurring may start on (design-doc D8: no date drift). */
export const RECURRING_MAX_MONTH_DAY = 28;

const recurringFields = {
  type: z.enum(CATEGORY_TYPES, { error: 'ประเภทต้องเป็นรายรับหรือรายจ่าย' }),
  walletId: idSchema,
  categoryId: idSchema,
  amount: positiveMoneySchema,
  note: optionalText(255),
  frequency: z.enum(RECURRING_FREQUENCIES, { error: 'ความถี่ไม่ถูกต้อง' }),
  /** First (or next) date the job creates a transaction — a date in the user's timezone. */
  nextRunDate: localDateSchema,
  /** Inclusive; null = no end. */
  endDate: localDateSchema.nullable().optional(),
};

interface RecurringRuleInput {
  frequency: (typeof RECURRING_FREQUENCIES)[number];
  nextRunDate: string;
  endDate?: string | null | undefined;
}

/**
 * Rules that involve more than one field. Shared by create and by the service,
 * which re-checks the MERGED record on PATCH (a PATCH may change only one of them).
 */
export function recurringRuleIssues(
  value: RecurringRuleInput,
): { path: string; message: string }[] {
  const issues: { path: string; message: string }[] = [];
  if (value.endDate && value.endDate < value.nextRunDate) {
    issues.push({ path: 'endDate', message: 'วันสิ้นสุดต้องไม่ก่อนวันที่เริ่ม' });
  }
  const day = Number(value.nextRunDate.slice(8, 10));
  if (
    (value.frequency === 'monthly' || value.frequency === 'yearly') &&
    day > RECURRING_MAX_MONTH_DAY
  ) {
    issues.push({
      path: 'nextRunDate',
      message: `รายการรายเดือน/รายปีต้องเริ่มวันที่ 1-${RECURRING_MAX_MONTH_DAY} (เดือนที่สั้นกว่าจะไม่มีวันนั้น)`,
    });
  }
  return issues;
}

export const createRecurringSchema = z.object(recurringFields).superRefine((value, ctx) => {
  for (const issue of recurringRuleIssues(value)) {
    ctx.addIssue({ code: 'custom', path: [issue.path], message: issue.message });
  }
});
export type CreateRecurringInput = z.input<typeof createRecurringSchema>;
export type CreateRecurringData = z.output<typeof createRecurringSchema>;

export const updateRecurringSchema = z
  .object({
    type: recurringFields.type.optional(),
    walletId: idSchema.optional(),
    categoryId: idSchema.optional(),
    amount: positiveMoneySchema.optional(),
    note: optionalText(255),
    frequency: recurringFields.frequency.optional(),
    nextRunDate: localDateSchema.optional(),
    endDate: localDateSchema.nullable().optional(),
    isActive: z.boolean({ error: 'isActive ต้องเป็น true/false' }).optional(),
  })
  .refine((value) => Object.values(value).some((field) => field !== undefined), {
    message: 'ต้องระบุอย่างน้อย 1 ฟิลด์ที่จะแก้ไข',
  });
export type UpdateRecurringInput = z.input<typeof updateRecurringSchema>;
export type UpdateRecurringData = z.output<typeof updateRecurringSchema>;
