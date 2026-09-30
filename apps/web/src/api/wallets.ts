import type { WalletDto } from '@income-expenses/shared';
import { useQuery } from '@tanstack/react-query';
import { api } from './client';
import { queryKeys } from './query-keys';

export function useWallets(includeArchived = false) {
  return useQuery({
    queryKey: queryKeys.wallets(includeArchived),
    queryFn: async () =>
      (await api.get<{ data: WalletDto[] }>('/wallets', { params: { includeArchived } })).data.data,
  });
}
