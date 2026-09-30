import type { BudgetDto, CopyBudgetsResultDto, CreateBudgetInput } from '@income-expenses/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from './client';
import { queryKeys } from './query-keys';

export function useBudgets(month: string) {
  return useQuery({
    queryKey: queryKeys.budgets(month),
    queryFn: async () =>
      (await api.get<{ data: BudgetDto[] }>('/budgets', { params: { month } })).data.data,
  });
}

function useInvalidateBudgets() {
  const queryClient = useQueryClient();
  return () => queryClient.invalidateQueries({ queryKey: ['budgets'] });
}

export function useCreateBudget() {
  const invalidate = useInvalidateBudgets();
  return useMutation({
    mutationFn: async (input: CreateBudgetInput) =>
      (await api.post<{ data: BudgetDto }>('/budgets', input)).data.data,
    onSuccess: invalidate,
  });
}

export function useUpdateBudget() {
  const invalidate = useInvalidateBudgets();
  return useMutation({
    mutationFn: async ({
      id,
      patch,
    }: {
      id: string;
      patch: { limitAmount?: string; alertPercent?: number };
    }) => (await api.patch<{ data: BudgetDto }>(`/budgets/${id}`, patch)).data.data,
    onSuccess: invalidate,
  });
}

export function useDeleteBudget() {
  const invalidate = useInvalidateBudgets();
  return useMutation({
    mutationFn: async (id: string) => {
      await api.delete(`/budgets/${id}`);
    },
    onSuccess: invalidate,
  });
}

export function useCopyBudgets() {
  const invalidate = useInvalidateBudgets();
  return useMutation({
    mutationFn: async (toMonth: string) =>
      (await api.post<{ data: CopyBudgetsResultDto }>('/budgets/copy', { toMonth })).data.data,
    onSuccess: invalidate,
  });
}
