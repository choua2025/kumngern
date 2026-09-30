import {
  createWalletSchema,
  listWalletsQuerySchema,
  updateWalletSchema,
} from '@income-expenses/shared';
import { idParamsSchema } from '../../lib/params.js';
import type { RequestSchemas } from '../../middlewares/validate.js';

export const listWalletsRequest = { query: listWalletsQuerySchema } satisfies RequestSchemas;
export const createWalletRequest = { body: createWalletSchema } satisfies RequestSchemas;
export const walletIdRequest = { params: idParamsSchema } satisfies RequestSchemas;
export const updateWalletRequest = {
  params: idParamsSchema,
  body: updateWalletSchema,
} satisfies RequestSchemas;
