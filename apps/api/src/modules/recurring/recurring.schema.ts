import { createRecurringSchema, updateRecurringSchema } from '@income-expenses/shared';
import { idParamsSchema } from '../../lib/params.js';
import type { RequestSchemas } from '../../middlewares/validate.js';

export const createRecurringRequest = { body: createRecurringSchema } satisfies RequestSchemas;

export const recurringIdRequest = { params: idParamsSchema } satisfies RequestSchemas;

export const updateRecurringRequest = {
  params: idParamsSchema,
  body: updateRecurringSchema,
} satisfies RequestSchemas;
