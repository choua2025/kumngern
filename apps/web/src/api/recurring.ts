import type {
  CreateRecurringInput,
  RecurringDto,
  UpdateRecurringInput,
} from '@income-expenses/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from './client';
import { queryKeys } from './query-keys';

export function useRecurring() {
  return useQuery({
    queryKey: queryKeys.recurring,
    queryFn: async () => (await api.get<{ data: RecurringDto[] }>('/recurring')).data.data,
  });
}

/** Rules only change future entries (the cron job creates them), so only this list refreshes. */
function useInvalidateRecurring() {
  const queryClient = useQueryClient();
  return () => queryClient.invalidateQueries({ queryKey: queryKeys.recurring });
}

export function useCreateRecurring() {
  const invalidate = useInvalidateRecurring();
  return useMutation({
    mutationFn: async (input: CreateRecurringInput) =>
      (await api.post<{ data: RecurringDto }>('/recurring', input)).data.data,
    onSuccess: invalidate,
  });
}

export function useUpdateRecurring() {
  const invalidate = useInvalidateRecurring();
  return useMutation({
    mutationFn: async ({ id, patch }: { id: string; patch: UpdateRecurringInput }) =>
      (await api.patch<{ data: RecurringDto }>(`/recurring/${id}`, patch)).data.data,
    onSuccess: invalidate,
  });
}

export function useDeleteRecurring() {
  const invalidate = useInvalidateRecurring();
  return useMutation({
    mutationFn: async (id: string) => {
      await api.delete(`/recurring/${id}`);
    },
    onSuccess: invalidate,
  });
}
