import { Router } from 'express';
import { requireAuth } from '../../middlewares/auth.js';
import { validate } from '../../middlewares/validate.js';
import { reportsController } from './reports.controller.js';
import {
  byCategoryReportRequest,
  dailyReportRequest,
  summaryReportRequest,
  trendReportRequest,
} from './reports.schema.js';

export function createReportsRouter(): Router {
  const router = Router();
  router.use(requireAuth);

  router.get('/summary', validate(summaryReportRequest), reportsController.summary);
  router.get('/by-category', validate(byCategoryReportRequest), reportsController.byCategory);
  router.get('/trend', validate(trendReportRequest), reportsController.trend);
  router.get('/daily', validate(dailyReportRequest), reportsController.daily);

  return router;
}
