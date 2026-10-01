import type {
  ListTransactionsQuery,
  PaginationMeta,
  TransactionDetailDto,
  TransactionDto,
  TransactionInput,
  UpdateTransactionInput,
} from '@income-expenses/shared';
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { filenameFromDisposition, saveBlob } from '../lib/download';
import { api } from './client';
import { LEDGER_KEYS, queryKeys } from './query-keys';

export type TransactionFilters = Partial<ListTransactionsQuery>;

export function useTransactions(filters: TransactionFilters) {
  return useQuery({
    queryKey: queryKeys.transactions(filters),
    queryFn: async () => {
      const response = await api.get<{ data: TransactionDto[]; meta: PaginationMeta }>(
        '/transactions',
        { params: filters },
      );
      return response.data;
    },
    // Keep showing the current page while the next one loads (no table flicker).
    placeholderData: keepPreviousData,
  });
}

/** After any write, everything derived from the ledger is stale. */
function useInvalidateLedger() {
  const queryClient = useQueryClient();
  return () =>
    Promise.all(LEDGER_KEYS.map((queryKey) => queryClient.invalidateQueries({ queryKey })));
}

export function useCreateTransaction() {
  const invalidate = useInvalidateLedger();
  return useMutation({
    mutationFn: async (input: TransactionInput) =>
      (await api.post<{ data: TransactionDetailDto }>('/transactions', input)).data.data,
    onSuccess: invalidate,
  });
}

export function useUpdateTransaction() {
  const invalidate = useInvalidateLedger();
  return useMutation({
    mutationFn: async ({ id, patch }: { id: string; patch: UpdateTransactionInput }) =>
      (await api.patch<{ data: TransactionDetailDto }>(`/transactions/${id}`, patch)).data.data,
    onSuccess: invalidate,
  });
}

export function useDeleteTransaction() {
  const invalidate = useInvalidateLedger();
  return useMutation({
    mutationFn: async (id: string) => {
      await api.delete(`/transactions/${id}`);
    },
    onSuccess: invalidate,
  });
}

export function useRestoreTransaction() {
  const invalidate = useInvalidateLedger();
  return useMutation({
    mutationFn: async (id: string) =>
      (await api.post<{ data: TransactionDetailDto }>(`/transactions/${id}/restore`)).data.data,
    onSuccess: invalidate,
  });
}

/** Downloads the CSV for the current filters (pagination is ignored by the API). */
export async function exportTransactionsCsv(filters: TransactionFilters): Promise<void> {
  const { page: _page, limit: _limit, ...query } = filters;
  const response = await api.get<Blob>('/transactions/export.csv', {
    params: query,
    responseType: 'blob',
  });
  const disposition = response.headers['content-disposition'] as string | undefined;
  saveBlob(response.data, filenameFromDisposition(disposition, 'transactions.csv'));
}
