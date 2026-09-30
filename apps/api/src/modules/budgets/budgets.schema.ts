import {
  budgetsQuerySchema,
  copyBudgetsSchema,
  createBudgetSchema,
  updateBudgetSchema,
} from '@income-expenses/shared';
import { idParamsSchema } from '../../lib/params.js';
import type { RequestSchemas } from '../../middlewares/validate.js';

export const listBudgetsRequest = { query: budgetsQuerySchema } satisfies RequestSchemas;
export const createBudgetRequest = { body: createBudgetSchema } satisfies RequestSchemas;
export const copyBudgetsRequest = { body: copyBudgetsSchema } satisfies RequestSchemas;
export const budgetIdRequest = { params: idParamsSchema } satisfies RequestSchemas;
export const updateBudgetRequest = {
  params: idParamsSchema,
  body: updateBudgetSchema,
} satisfies RequestSchemas;
