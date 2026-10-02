import { z } from 'zod';
import { msg } from '../messages/index.js';
import { CATEGORY_TYPES } from '../constants.js';
import { monthSchema } from './budgets.js';
import { localDateSchema } from './primitives.js';

export const summaryReportQuerySchema = z.object({ month: monthSchema });

export const byCategoryReportQuerySchema = z
  .object({
    from: localDateSchema,
    to: localDateSchema,
    type: z.enum(CATEGORY_TYPES).default('expense'),
  })
  .refine((value) => value.from <= value.to, {
    message: msg('validation.dateRange'),
    path: ['to'],
  });

export const trendReportQuerySchema = z.object({
  months: z.coerce.number().int().min(1).max(24).default(6),
});

export const dailyReportQuerySchema = z.object({ month: monthSchema });
