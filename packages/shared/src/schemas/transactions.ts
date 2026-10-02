import { z } from 'zod';
import { msg } from '../messages/index.js';
import { PAGINATION_DEFAULT_LIMIT, PAGINATION_MAX_LIMIT, TRANSACTION_TYPES } from '../constants.js';
import {
  idSchema,
  instantSchema,
  localDateSchema,
  moneySchema,
  optionalText,
  positiveMoneySchema,
} from './primitives.js';

const MAX_TAGS_PER_TRANSACTION = 10;

const tagIdsSchema = z
  .array(idSchema)
  .max(MAX_TAGS_PER_TRANSACTION, msg('validation.maxTags', { max: MAX_TAGS_PER_TRANSACTION }))
  .refine((ids) => new Set(ids).size === ids.length, msg('validation.duplicateTags'));

const baseFields = {
  walletId: idSchema,
  amount: positiveMoneySchema,
  note: optionalText(255),
  occurredAt: instantSchema,
  tagIds: tagIdsSchema.optional(),
};

const incomeExpenseFields = {
  ...baseFields,
  categoryId: idSchema,
};

const transferSchema = z
  .object({
    ...baseFields,
    type: z.literal('transfer'),
    toWalletId: idSchema,
    /** Required only when the two wallets have different currencies (checked in the service). */
    toAmount: positiveMoneySchema.nullable().optional(),
  })
  .refine((value) => value.walletId !== value.toWalletId, {
    message: msg('validation.walletsMustDiffer'),
    path: ['toWalletId'],
  });

/**
 * Discriminated union: the shape depends on `type`, mirroring chk_tx_shape.
 * Unknown keys are stripped, so a transfer silently drops a stray `categoryId`.
 */
export const transactionInputSchema = z.discriminatedUnion('type', [
  z.object({ ...incomeExpenseFields, type: z.literal('income') }),
  z.object({ ...incomeExpenseFields, type: z.literal('expense') }),
  transferSchema,
]);
export type TransactionInput = z.input<typeof transactionInputSchema>;
export type ParsedTransactionInput = z.output<typeof transactionInputSchema>;

/**
 * PATCH: any subset of fields. The service merges it with the stored transaction
 * and validates the RESULT with transactionInputSchema, so every rule still applies.
 */
export const updateTransactionSchema = z
  .object({
    type: z.enum(TRANSACTION_TYPES).optional(),
    walletId: idSchema.optional(),
    toWalletId: idSchema.nullable().optional(),
    categoryId: idSchema.nullable().optional(),
    amount: moneySchema.optional(),
    toAmount: moneySchema.nullable().optional(),
    note: optionalText(255),
    occurredAt: instantSchema.optional(),
    tagIds: tagIdsSchema.optional(),
  })
  .refine((value) => Object.values(value).some((field) => field !== undefined), {
    message: msg('validation.atLeastOneField'),
  });
export type UpdateTransactionInput = z.input<typeof updateTransactionSchema>;
export type UpdateTransactionData = z.output<typeof updateTransactionSchema>;

export const TRANSACTION_SORTS = [
  'occurredAt:desc',
  'occurredAt:asc',
  'amount:desc',
  'amount:asc',
] as const;
export type TransactionSort = (typeof TRANSACTION_SORTS)[number];

/** Filters shared by the list and the CSV export (same rules, one definition). */
const transactionFilterFields = {
  from: localDateSchema.optional(),
  to: localDateSchema.optional(),
  type: z.enum(TRANSACTION_TYPES).optional(),
  walletId: idSchema.optional(),
  categoryId: idSchema.optional(),
  tagId: idSchema.optional(),
  q: z.string().trim().min(1).max(100).optional(),
  deleted: z.stringbool().default(false),
  sort: z.enum(TRANSACTION_SORTS).default('occurredAt:desc'),
};

const validDateRange = <T extends { from?: string | undefined; to?: string | undefined }>(
  value: T,
) => !value.from || !value.to || value.from <= value.to;
const dateRangeError = { message: msg('validation.dateRange'), path: ['to'] };

export const listTransactionsQuerySchema = z
  .object({
    ...transactionFilterFields,
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce
      .number()
      .int()
      .min(1)
      .max(PAGINATION_MAX_LIMIT)
      .default(PAGINATION_DEFAULT_LIMIT),
  })
  .refine(validDateRange, dateRangeError);
export type ListTransactionsQuery = z.output<typeof listTransactionsQuerySchema>;

export const exportTransactionsQuerySchema = z
  .object(transactionFilterFields)
  .refine(validDateRange, dateRangeError);
export type ExportTransactionsQuery = z.output<typeof exportTransactionsQuerySchema>;

/** Hard cap for one CSV export (protects the server; the UI tells the user to narrow the range). */
export const MAX_EXPORT_ROWS = 50_000;
