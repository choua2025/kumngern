import type { ListTransactionsQuery } from '@income-expenses/shared';

/**
 * One place for every TanStack Query key. Keys are hierarchical, so
 * invalidating ['transactions'] refreshes every filtered list at once.
 */
export const queryKeys = {
  me: ['me'] as const,
  currencies: ['currencies'] as const,
  wallets: (includeArchived = false) => ['wallets', { includeArchived }] as const,
  categories: (type?: 'income' | 'expense') => ['categories', { type }] as const,
  transactions: (filters: Partial<ListTransactionsQuery>) => ['transactions', filters] as const,
  budgets: (month: string) => ['budgets', month] as const,
  reports: {
    summary: (month: string) => ['reports', 'summary', month] as const,
    byCategory: (from: string, to: string, type: string) =>
      ['reports', 'by-category', { from, to, type }] as const,
    trend: (months: number) => ['reports', 'trend', months] as const,
    daily: (month: string) => ['reports', 'daily', month] as const,
  },
};

/** Everything whose numbers change when a transaction is created, edited or deleted. */
export const LEDGER_KEYS = [['transactions'], ['wallets'], ['reports'], ['budgets']] as const;
