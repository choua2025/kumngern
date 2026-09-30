import { Router } from 'express';
import { requireAuth } from '../../middlewares/auth.js';
import { validate } from '../../middlewares/validate.js';
import { budgetsController } from './budgets.controller.js';
import {
  budgetIdRequest,
  copyBudgetsRequest,
  createBudgetRequest,
  listBudgetsRequest,
  updateBudgetRequest,
} from './budgets.schema.js';

export function createBudgetsRouter(): Router {
  const router = Router();
  router.use(requireAuth);

  router.get('/', validate(listBudgetsRequest), budgetsController.list);
  router.post('/', validate(createBudgetRequest), budgetsController.create);
  // Static path before /:id
  router.post('/copy', validate(copyBudgetsRequest), budgetsController.copy);
  router.patch('/:id', validate(updateBudgetRequest), budgetsController.update);
  router.delete('/:id', validate(budgetIdRequest), budgetsController.delete);

  return router;
}
