import {
  ALLOWED_ATTACHMENT_MIME_TYPES,
  type AttachmentDto,
  MAX_ATTACHMENT_SIZE_BYTES,
  MAX_ATTACHMENTS_PER_TRANSACTION,
} from '@income-expenses/shared';
import { FileText, Paperclip, Trash2 } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  fetchAttachmentBlob,
  useAttachmentObjectUrl,
  useDeleteAttachment,
  useTransactionDetail,
  useUploadAttachments,
} from '../../api/attachments';
import { errorMessage } from '../../api/errors';
import { Button } from '../../components/Button';
import { useToast } from '../../components/toast';
import { i18n } from '../../i18n';
import { saveBlob } from '../../lib/download';

const MB = 1024 * 1024;

function formatSize(bytes: number): string {
  return bytes >= MB
    ? `${(bytes / MB).toFixed(1)} MB`
    : `${Math.max(1, Math.round(bytes / 1024))} KB`;
}

/** Client-side check for a quick message; the API re-checks everything (magic bytes too). */
export function checkFiles(files: File[], existing: number): string | null {
  if (existing + files.length > MAX_ATTACHMENTS_PER_TRANSACTION) {
    return i18n.t('attachments.maxPerTransaction', { max: MAX_ATTACHMENTS_PER_TRANSACTION });
  }
  const tooBig = files.find((file) => file.size > MAX_ATTACHMENT_SIZE_BYTES);
  if (tooBig) return i18n.t('attachments.tooBig', { name: tooBig.name });
  const allowed: readonly string[] = ALLOWED_ATTACHMENT_MIME_TYPES;
  const wrongType = files.find((file) => !allowed.includes(file.type));
  if (wrongType) return i18n.t('attachments.unsupported', { name: wrongType.name });
  return null;
}

function AttachmentItem({ attachment }: { attachment: AttachmentDto }) {
  const { t } = useTranslation();
  const isImage = attachment.mimeType.startsWith('image/');
  const thumbnail = useAttachmentObjectUrl(attachment.id, isImage);
  const deleteAttachment = useDeleteAttachment();
  const toast = useToast();
  const [confirming, setConfirming] = useState(false);

  // The "confirm delete" state times out, so a stray second click later does not delete.
  useEffect(() => {
    if (!confirming) return undefined;
    const timer = setTimeout(() => setConfirming(false), 3000);
    return () => clearTimeout(timer);
  }, [confirming]);

  const open = async () => {
    if (thumbnail) {
      window.open(thumbnail, '_blank', 'noopener');
      return;
    }
    try {
      saveBlob(await fetchAttachmentBlob(attachment.id), attachment.originalName);
    } catch (error) {
      toast.show(errorMessage(error), { tone: 'error' });
    }
  };

  const remove = async () => {
    try {
      await deleteAttachment.mutateAsync(attachment.id);
      toast.show(t('attachments.deleted'));
    } catch (error) {
      toast.show(errorMessage(error), { tone: 'error' });
    }
  };

  return (
    <li className="flex items-center gap-3 rounded-lg p-2 ring-1 ring-slate-200 dark:ring-slate-800">
      <button
        type="button"
        onClick={() => void open()}
        className="flex min-w-0 flex-1 items-center gap-3 text-left"
        aria-label={t('attachments.open', { name: attachment.originalName })}
      >
        <span className="flex size-12 shrink-0 items-center justify-center overflow-hidden rounded-md bg-slate-100 dark:bg-slate-800">
          {thumbnail ? (
            <img src={thumbnail} alt="" className="size-full object-cover" />
          ) : (
            <FileText className="size-6 text-slate-500" aria-hidden />
          )}
        </span>
        <span className="min-w-0">
          <span className="block truncate text-sm font-medium">{attachment.originalName}</span>
          <span className="block text-xs text-slate-500">{formatSize(attachment.sizeBytes)}</span>
        </span>
      </button>
      {confirming ? (
        <Button
          variant="danger"
          size="sm"
          loading={deleteAttachment.isPending}
          onClick={() => void remove()}
        >
          {t('common.confirmDelete')}
        </Button>
      ) : (
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setConfirming(true)}
          aria-label={t('common.deleteItem', { name: attachment.originalName })}
        >
          <Trash2 className="size-4" aria-hidden />
        </Button>
      )}
    </li>
  );
}

/** Receipts and documents of one saved transaction (shown when editing it). */
export function AttachmentsSection({ transactionId }: { transactionId: string }) {
  const { t } = useTranslation();
  const detail = useTransactionDetail(transactionId);
  const upload = useUploadAttachments(transactionId);
  const toast = useToast();
  const inputRef = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string | null>(null);

  const attachments = detail.data?.attachments ?? [];
  const full = attachments.length >= MAX_ATTACHMENTS_PER_TRANSACTION;

  const onFiles = async (fileList: FileList | null) => {
    const files = Array.from(fileList ?? []);
    if (inputRef.current) inputRef.current.value = ''; // allow picking the same file again
    if (files.length === 0) return;
    const problem = checkFiles(files, attachments.length);
    setError(problem);
    if (problem) return;
    try {
      await upload.mutateAsync(files);
      toast.show(t('attachments.uploaded', { count: files.length }));
    } catch (uploadError) {
      setError(errorMessage(uploadError));
    }
  };

  return (
    <section
      aria-labelledby="attachments-heading"
      className="mt-6 space-y-3 border-t border-slate-200 pt-4 dark:border-slate-800"
    >
      <div className="flex items-center justify-between gap-2">
        <h3 id="attachments-heading" className="text-sm font-semibold">
          {t('attachments.heading', {
            count: attachments.length,
            max: MAX_ATTACHMENTS_PER_TRANSACTION,
          })}
        </h3>
        <Button
          variant="secondary"
          size="sm"
          disabled={full || detail.isPending}
          loading={upload.isPending}
          onClick={() => inputRef.current?.click()}
        >
          <Paperclip className="size-4" aria-hidden /> {t('attachments.attach')}
        </Button>
        <input
          ref={inputRef}
          type="file"
          multiple
          accept={ALLOWED_ATTACHMENT_MIME_TYPES.join(',')}
          className="sr-only"
          tabIndex={-1}
          aria-label={t('attachments.choose')}
          onChange={(event) => void onFiles(event.target.files)}
        />
      </div>
      {error && (
        <p role="alert" className="text-sm text-red-600 dark:text-red-400">
          {error}
        </p>
      )}
      {attachments.length > 0 ? (
        <ul className="space-y-2">
          {attachments.map((attachment) => (
            <AttachmentItem key={attachment.id} attachment={attachment} />
          ))}
        </ul>
      ) : (
        !detail.isPending && (
          <p className="text-sm text-slate-500">
            {t('attachments.hint', { max: MAX_ATTACHMENTS_PER_TRANSACTION })}
          </p>
        )
      )}
    </section>
  );
}
