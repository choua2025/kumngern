import type { CreateWalletInput, UpdateWalletInput, WalletDto } from '@income-expenses/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from './client';
import { LEDGER_KEYS, queryKeys } from './query-keys';

export function useWallets(includeArchived = false) {
  return useQuery({
    queryKey: queryKeys.wallets(includeArchived),
    queryFn: async () =>
      (await api.get<{ data: WalletDto[] }>('/wallets', { params: { includeArchived } })).data.data,
  });
}

/** Wallet names/balances appear in transactions, reports and budgets too. */
function useInvalidateLedger() {
  const queryClient = useQueryClient();
  return () =>
    Promise.all(LEDGER_KEYS.map((queryKey) => queryClient.invalidateQueries({ queryKey })));
}

export function useCreateWallet() {
  const invalidate = useInvalidateLedger();
  return useMutation({
    mutationFn: async (input: CreateWalletInput) =>
      (await api.post<{ data: WalletDto }>('/wallets', input)).data.data,
    onSuccess: invalidate,
  });
}

export function useUpdateWallet() {
  const invalidate = useInvalidateLedger();
  return useMutation({
    mutationFn: async ({ id, patch }: { id: string; patch: UpdateWalletInput }) =>
      (await api.patch<{ data: WalletDto }>(`/wallets/${id}`, patch)).data.data,
    onSuccess: invalidate,
  });
}

export function useDeleteWallet() {
  const invalidate = useInvalidateLedger();
  return useMutation({
    mutationFn: async (id: string) => {
      await api.delete(`/wallets/${id}`);
    },
    onSuccess: invalidate,
  });
}
