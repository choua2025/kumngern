import type { TagRefDto } from '@income-expenses/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from './client';

const TAGS_KEY = ['tags'] as const;

export function useTags() {
  return useQuery({
    queryKey: TAGS_KEY,
    queryFn: async () => (await api.get<{ data: TagRefDto[] }>('/tags')).data.data,
  });
}

/** Tag names appear inside transactions too, so those lists refresh as well. */
function useInvalidateTags() {
  const queryClient = useQueryClient();
  return () =>
    Promise.all([
      queryClient.invalidateQueries({ queryKey: TAGS_KEY }),
      queryClient.invalidateQueries({ queryKey: ['transactions'] }),
    ]);
}

export function useCreateTag() {
  const invalidate = useInvalidateTags();
  return useMutation({
    mutationFn: async (name: string) =>
      (await api.post<{ data: TagRefDto }>('/tags', { name })).data.data,
    onSuccess: invalidate,
  });
}

export function useRenameTag() {
  const invalidate = useInvalidateTags();
  return useMutation({
    mutationFn: async ({ id, name }: { id: string; name: string }) =>
      (await api.patch<{ data: TagRefDto }>(`/tags/${id}`, { name })).data.data,
    onSuccess: invalidate,
  });
}

export function useDeleteTag() {
  const invalidate = useInvalidateTags();
  return useMutation({
    mutationFn: async (id: string) => {
      await api.delete(`/tags/${id}`);
    },
    onSuccess: invalidate,
  });
}
