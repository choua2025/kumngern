import { z } from 'zod';
import { msg } from '../messages/index.js';
import { WALLET_TYPES } from '../constants.js';
import { currencyCodeSchema } from './common.js';
import { signedMoneySchema } from './primitives.js';

const walletNameSchema = z
  .string({ error: msg('validation.walletNameRequired') })
  .trim()
  .min(1, msg('validation.walletNameRequired'))
  .max(100, msg('validation.nameTooLong', { max: 100 }));

const walletTypeSchema = z.enum(WALLET_TYPES, { error: msg('validation.walletTypeInvalid') });

export const createWalletSchema = z.object({
  name: walletNameSchema,
  type: walletTypeSchema,
  currencyCode: currencyCodeSchema,
  initialBalance: signedMoneySchema.default('0'),
});
/** What a form sends (initialBalance optional). */
export type CreateWalletInput = z.input<typeof createWalletSchema>;
/** After validation (defaults applied) — what the service receives. */
export type CreateWalletData = z.output<typeof createWalletSchema>;

/** Currency is not editable: existing transactions are in that currency. */
export const updateWalletSchema = z
  .object({
    name: walletNameSchema.optional(),
    type: walletTypeSchema.optional(),
    isArchived: z.boolean().optional(),
  })
  .refine((value) => Object.values(value).some((field) => field !== undefined), {
    message: msg('validation.atLeastOneField'),
  });
export type UpdateWalletInput = z.infer<typeof updateWalletSchema>;

export const listWalletsQuerySchema = z.object({
  includeArchived: z.stringbool().default(false),
});
