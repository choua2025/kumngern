import {
  createCategorySchema,
  listCategoriesQuerySchema,
  updateCategorySchema,
} from '@income-expenses/shared';
import { idParamsSchema } from '../../lib/params.js';
import type { RequestSchemas } from '../../middlewares/validate.js';

export const listCategoriesRequest = { query: listCategoriesQuerySchema } satisfies RequestSchemas;
export const createCategoryRequest = { body: createCategorySchema } satisfies RequestSchemas;
export const categoryIdRequest = { params: idParamsSchema } satisfies RequestSchemas;
export const updateCategoryRequest = {
  params: idParamsSchema,
  body: updateCategorySchema,
} satisfies RequestSchemas;
