/**
 * Domain constants from the spec (docs/erd.md).
 * These values mirror the CHECK constraints in the database — change both together.
 */

export const API_PREFIX = '/api/v1';

export const WALLET_TYPES = ['cash', 'bank', 'ewallet', 'credit_card', 'saving'] as const;
export type WalletType = (typeof WALLET_TYPES)[number];

export const CATEGORY_TYPES = ['income', 'expense'] as const;
export type CategoryType = (typeof CATEGORY_TYPES)[number];

export const TRANSACTION_TYPES = ['income', 'expense', 'transfer'] as const;
export type TransactionType = (typeof TRANSACTION_TYPES)[number];

export const RECURRING_FREQUENCIES = ['daily', 'weekly', 'monthly', 'yearly'] as const;
export type RecurringFrequency = (typeof RECURRING_FREQUENCIES)[number];

export const BUDGET_STATUSES = ['ok', 'warning', 'over'] as const;
export type BudgetStatus = (typeof BUDGET_STATUSES)[number];

export const ALLOWED_ATTACHMENT_MIME_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'application/pdf',
] as const;
export type AttachmentMimeType = (typeof ALLOWED_ATTACHMENT_MIME_TYPES)[number];

export const MAX_ATTACHMENT_SIZE_BYTES = 5 * 1024 * 1024;
export const MAX_ATTACHMENTS_PER_TRANSACTION = 3;

export const PAGINATION_DEFAULT_LIMIT = 20;
export const PAGINATION_MAX_LIMIT = 100;

export const ERROR_CODES = [
  'VALIDATION_ERROR',
  'UNAUTHORIZED',
  'FORBIDDEN',
  'NOT_FOUND',
  'CONFLICT',
  'RATE_LIMITED',
  'INTERNAL_ERROR',
] as const;
export type ErrorCode = (typeof ERROR_CODES)[number];
