import type { AttachmentDto, TransactionDetailDto } from '@income-expenses/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { api } from './client';
import { queryKeys } from './query-keys';

/** Detail = the list item + its attachments. Lives under ['transactions'], so ledger writes refresh it. */
export function useTransactionDetail(id: string) {
  return useQuery({
    queryKey: queryKeys.transactionDetail(id),
    queryFn: async () =>
      (await api.get<{ data: TransactionDetailDto }>(`/transactions/${id}`)).data.data,
  });
}

/** attachmentCount in the list and the detail both change. */
function useInvalidateTransactions() {
  const queryClient = useQueryClient();
  return () => queryClient.invalidateQueries({ queryKey: ['transactions'] });
}

export function useUploadAttachments(transactionId: string) {
  const invalidate = useInvalidateTransactions();
  return useMutation({
    mutationFn: async (files: File[]) => {
      const form = new FormData();
      for (const file of files) form.append('files', file);
      // No Content-Type here: the browser adds multipart/form-data WITH the boundary.
      return (
        await api.post<{ data: AttachmentDto[] }>(
          `/transactions/${transactionId}/attachments`,
          form,
        )
      ).data.data;
    },
    onSuccess: invalidate,
  });
}

export function useDeleteAttachment() {
  const invalidate = useInvalidateTransactions();
  return useMutation({
    mutationFn: async (id: string) => {
      await api.delete(`/attachments/${id}`);
    },
    onSuccess: invalidate,
  });
}

export async function fetchAttachmentBlob(id: string): Promise<Blob> {
  return (await api.get<Blob>(`/attachments/${id}`, { responseType: 'blob' })).data;
}

/**
 * `<img src="/api/v1/attachments/7">` cannot work: the browser would not send the
 * in-memory Bearer token. So the file is fetched with axios and shown through a
 * blob: URL — which must be revoked on unmount, or the image stays in memory.
 */
export function useAttachmentObjectUrl(id: string, enabled: boolean): string | null {
  const [url, setUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!enabled) return undefined;
    let objectUrl: string | null = null;
    let cancelled = false;
    fetchAttachmentBlob(id)
      .then((blob) => {
        if (cancelled) return;
        objectUrl = URL.createObjectURL(blob);
        setUrl(objectUrl);
      })
      .catch(() => {
        if (!cancelled) setUrl(null);
      });
    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [id, enabled]);

  return enabled ? url : null;
}
