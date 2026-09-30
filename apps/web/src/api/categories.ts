import type {
  CategoryDto,
  CreateCategoryInput,
  UpdateCategoryInput,
} from '@income-expenses/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from './client';
import { LEDGER_KEYS, queryKeys } from './query-keys';

export function useCategories(type?: 'income' | 'expense') {
  return useQuery({
    queryKey: queryKeys.categories(type),
    queryFn: async () =>
      (await api.get<{ data: CategoryDto[] }>('/categories', { params: { type } })).data.data,
    staleTime: 5 * 60_000,
  });
}

/** Tree → flat list with children right after their parent (for pickers and filters). */
export function flattenCategories(tree: CategoryDto[]): (CategoryDto & { depth: number })[] {
  return tree.flatMap((root) => [
    { ...root, depth: 0 },
    ...root.children.map((child) => ({ ...child, depth: 1 })),
  ]);
}

/** Category names/icons are shown in transactions, budgets and reports. */
function useInvalidateCategories() {
  const queryClient = useQueryClient();
  return () =>
    Promise.all(
      [['categories'], ...LEDGER_KEYS].map((queryKey) =>
        queryClient.invalidateQueries({ queryKey }),
      ),
    );
}

export function useCreateCategory() {
  const invalidate = useInvalidateCategories();
  return useMutation({
    mutationFn: async (input: CreateCategoryInput) =>
      (await api.post<{ data: CategoryDto }>('/categories', input)).data.data,
    onSuccess: invalidate,
  });
}

export function useUpdateCategory() {
  const invalidate = useInvalidateCategories();
  return useMutation({
    mutationFn: async ({ id, patch }: { id: string; patch: UpdateCategoryInput }) =>
      (await api.patch<{ data: CategoryDto }>(`/categories/${id}`, patch)).data.data,
    onSuccess: invalidate,
  });
}

export function useDeleteCategory() {
  const invalidate = useInvalidateCategories();
  return useMutation({
    mutationFn: async (id: string) => {
      await api.delete(`/categories/${id}`);
    },
    onSuccess: invalidate,
  });
}
