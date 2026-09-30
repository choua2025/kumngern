import {
  listTransactionsQuerySchema,
  transactionInputSchema,
  updateTransactionSchema,
} from '@income-expenses/shared';
import { idParamsSchema } from '../../lib/params.js';
import type { RequestSchemas } from '../../middlewares/validate.js';

export const listTransactionsRequest = {
  query: listTransactionsQuerySchema,
} satisfies RequestSchemas;
export const createTransactionRequest = { body: transactionInputSchema } satisfies RequestSchemas;
export const transactionIdRequest = { params: idParamsSchema } satisfies RequestSchemas;
export const updateTransactionRequest = {
  params: idParamsSchema,
  body: updateTransactionSchema,
} satisfies RequestSchemas;
