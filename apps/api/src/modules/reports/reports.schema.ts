import {
  byCategoryReportQuerySchema,
  dailyReportQuerySchema,
  summaryReportQuerySchema,
  trendReportQuerySchema,
} from '@income-expenses/shared';
import type { RequestSchemas } from '../../middlewares/validate.js';

export const summaryReportRequest = { query: summaryReportQuerySchema } satisfies RequestSchemas;
export const byCategoryReportRequest = {
  query: byCategoryReportQuerySchema,
} satisfies RequestSchemas;
export const trendReportRequest = { query: trendReportQuerySchema } satisfies RequestSchemas;
export const dailyReportRequest = { query: dailyReportQuerySchema } satisfies RequestSchemas;
