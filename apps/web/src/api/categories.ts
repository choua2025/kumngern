import type { CategoryDto } from '@income-expenses/shared';
import { useQuery } from '@tanstack/react-query';
import { api } from './client';
import { queryKeys } from './query-keys';

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
