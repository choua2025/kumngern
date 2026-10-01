import { createTagSchema, updateTagSchema } from '@income-expenses/shared';
import { idParamsSchema } from '../../lib/params.js';
import type { RequestSchemas } from '../../middlewares/validate.js';

export const createTagRequest = { body: createTagSchema } satisfies RequestSchemas;
export const tagIdRequest = { params: idParamsSchema } satisfies RequestSchemas;
export const updateTagRequest = {
  params: idParamsSchema,
  body: updateTagSchema,
} satisfies RequestSchemas;
