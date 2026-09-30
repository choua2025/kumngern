import { z } from 'zod';
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
  .max(MAX_TAGS_PER_TRANSACTION, `แท็กได้สูงสุด ${MAX_TAGS_PER_TRANSACTION} แท็ก`)
  .refine((ids) => new Set(ids).size === ids.length, 'มีแท็กซ้ำกัน');

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
    message: 'กระเป๋าต้นทางและปลายทางต้องไม่ใช่ใบเดียวกัน',
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
    message: 'ต้องระบุอย่างน้อย 1 ฟิลด์ที่จะแก้ไข',
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

export const listTransactionsQuerySchema = z
  .object({
    from: localDateSchema.optional(),
    to: localDateSchema.optional(),
    type: z.enum(TRANSACTION_TYPES).optional(),
    walletId: idSchema.optional(),
    categoryId: idSchema.optional(),
    tagId: idSchema.optional(),
    q: z.string().trim().min(1).max(100).optional(),
    deleted: z.stringbool().default(false),
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce
      .number()
      .int()
      .min(1)
      .max(PAGINATION_MAX_LIMIT)
      .default(PAGINATION_DEFAULT_LIMIT),
    sort: z.enum(TRANSACTION_SORTS).default('occurredAt:desc'),
  })
  .refine((value) => !value.from || !value.to || value.from <= value.to, {
    message: 'วันที่เริ่มต้องไม่เกินวันที่สิ้นสุด',
    path: ['to'],
  });
export type ListTransactionsQuery = z.output<typeof listTransactionsQuerySchema>;
