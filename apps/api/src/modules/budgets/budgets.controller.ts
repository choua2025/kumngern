import { asyncHandler } from '../../lib/async-handler.js';
import { currentUserId } from '../../middlewares/auth.js';
import type { ValidatedRequest } from '../../middlewares/validate.js';
import type {
  budgetIdRequest,
  copyBudgetsRequest,
  createBudgetRequest,
  listBudgetsRequest,
  updateBudgetRequest,
} from './budgets.schema.js';
import { budgetsService } from './budgets.service.js';

export const budgetsController = {
  list: asyncHandler<ValidatedRequest<typeof listBudgetsRequest>>(async (req, res) => {
    const budgets = await budgetsService.list(currentUserId(req), req.query.month);
    res.json({ data: budgets });
  }),

  create: asyncHandler<ValidatedRequest<typeof createBudgetRequest>>(async (req, res) => {
    const budget = await budgetsService.create(currentUserId(req), req.body);
    res.status(201).json({ data: budget });
  }),

  copy: asyncHandler<ValidatedRequest<typeof copyBudgetsRequest>>(async (req, res) => {
    const result = await budgetsService.copyFromPreviousMonth(currentUserId(req), req.body);
    res.json({ data: result });
  }),

  update: asyncHandler<ValidatedRequest<typeof updateBudgetRequest>>(async (req, res) => {
    const budget = await budgetsService.update(currentUserId(req), req.params.id, req.body);
    res.json({ data: budget });
  }),

  delete: asyncHandler<ValidatedRequest<typeof budgetIdRequest>>(async (req, res) => {
    await budgetsService.delete(currentUserId(req), req.params.id);
    res.status(204).end();
  }),
};
