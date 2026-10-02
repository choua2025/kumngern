import { useTranslation } from 'react-i18next';
import { Button } from './Button';
import { Modal } from './Modal';

interface ConfirmDialogProps {
  open: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  loading?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

/**
 * For actions that CANNOT be undone (hard deletes). Reversible actions such as
 * deleting a transaction use an Undo toast instead of interrupting the user.
 */
export function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel,
  loading = false,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  const { t } = useTranslation();
  return (
    <Modal open={open} onClose={onCancel} title={title}>
      <p className="text-slate-600 dark:text-slate-300">{message}</p>
      <div className="mt-6 flex justify-end gap-2">
        <Button variant="secondary" onClick={onCancel}>
          {t('common.cancel')}
        </Button>
        <Button variant="danger" loading={loading} onClick={onConfirm}>
          {confirmLabel ?? t('common.delete')}
        </Button>
      </div>
    </Modal>
  );
}
