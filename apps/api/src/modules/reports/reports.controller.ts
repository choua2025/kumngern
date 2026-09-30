import { asyncHandler } from '../../lib/async-handler.js';
import { currentUserId } from '../../middlewares/auth.js';
import type { ValidatedRequest } from '../../middlewares/validate.js';
import type {
  byCategoryReportRequest,
  dailyReportRequest,
  summaryReportRequest,
  trendReportRequest,
} from './reports.schema.js';
import { reportsService } from './reports.service.js';

export const reportsController = {
  summary: asyncHandler<ValidatedRequest<typeof summaryReportRequest>>(async (req, res) => {
    res.json({ data: await reportsService.summary(currentUserId(req), req.query.month) });
  }),

  byCategory: asyncHandler<ValidatedRequest<typeof byCategoryReportRequest>>(async (req, res) => {
    res.json({ data: await reportsService.byCategory(currentUserId(req), req.query) });
  }),

  trend: asyncHandler<ValidatedRequest<typeof trendReportRequest>>(async (req, res) => {
    res.json({ data: await reportsService.trend(currentUserId(req), req.query.months) });
  }),

  daily: asyncHandler<ValidatedRequest<typeof dailyReportRequest>>(async (req, res) => {
    res.json({ data: await reportsService.daily(currentUserId(req), req.query.month) });
  }),
};
