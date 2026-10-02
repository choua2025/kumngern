import type { RecurringDto } from '@income-expenses/shared';
import { Pencil, Plus, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toApiError } from '../../api/errors';
import { useDeleteRecurring, useRecurring, useUpdateRecurring } from '../../api/recurring';
import { Button } from '../../components/Button';
import { CategoryIcon } from '../../components/CategoryIcon';
import { ConfirmDialog } from '../../components/ConfirmDialog';
import { Money } from '../../components/Money';
import { Card, EmptyState, ErrorState, LoadingRows } from '../../components/states';
import { useToast } from '../../components/toast';
import { cn } from '../../lib/cn';
import { formatLocalDate, frequencyLabel } from './labels';
import { RecurringFormModal } from './RecurringFormModal';

/** Field-level messages (e.g. "start date must not be in the past") say more than the summary. */
function detailedMessage(error: unknown): string {
  const apiError = toApiError(error);
  return apiError.details[0]?.message ?? apiError.message;
}

function ActiveSwitch({ recurring }: { recurring: RecurringDto }) {
  const { t } = useTranslation();
  const update = useUpdateRecurring();
  const toast = useToast();
  const label = recurring.isActive ? t('recurring.pause') : t('recurring.resume');

  const toggle = async () => {
    try {
      await update.mutateAsync({ id: recurring.id, patch: { isActive: !recurring.isActive } });
      toast.show(recurring.isActive ? t('recurring.paused') : t('recurring.resumed'));
    } catch (error) {
      toast.show(detailedMessage(error), { tone: 'error' });
    }
  };

  return (
    <button
      type="button"
      role="switch"
      aria-checked={recurring.isActive}
      aria-label={`${label}: ${recurring.note ?? recurring.category.name}`}
      title={label}
      disabled={update.isPending}
      onClick={() => void toggle()}
      className={cn(
        'relative inline-flex h-6 w-11 shrink-0 rounded-full transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 disabled:opacity-50',
        recurring.isActive ? 'bg-blue-600' : 'bg-slate-300 dark:bg-slate-700',
      )}
    >
      <span
        aria-hidden
        className={cn(
          'absolute top-0.5 left-0.5 size-5 rounded-full bg-white shadow transition-transform',
          recurring.isActive && 'translate-x-5',
        )}
      />
    </button>
  );
}

export function RecurringPage() {
  const { t } = useTranslation();
  const recurring = useRecurring();
  const deleteRecurring = useDeleteRecurring();
  const toast = useToast();
  const [editing, setEditing] = useState<RecurringDto | 'new' | null>(null);
  const [deleting, setDeleting] = useState<RecurringDto | null>(null);

  const confirmDelete = async () => {
    if (!deleting) return;
    try {
      await deleteRecurring.mutateAsync(deleting.id);
      toast.show(t('recurring.deleted'));
    } catch (error) {
      toast.show(detailedMessage(error), { tone: 'error' });
    } finally {
      setDeleting(null);
    }
  };

  const list = recurring.data ?? [];

  return (
    <div className="space-y-4">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">{t('recurring.title')}</h1>
          <p className="text-sm text-slate-500">{t('recurring.subtitle')}</p>
        </div>
        <Button onClick={() => setEditing('new')}>
          <Plus className="size-4" aria-hidden /> {t('recurring.add')}
        </Button>
      </header>

      {recurring.isPending ? (
        <Card>
          <LoadingRows rows={4} />
        </Card>
      ) : recurring.isError ? (
        <ErrorState error={recurring.error} onRetry={() => void recurring.refetch()} />
      ) : list.length === 0 ? (
        <EmptyState title={t('recurring.empty')} description={t('recurring.emptyHint')} />
      ) : (
        <Card>
          <ul className="divide-y divide-slate-200 dark:divide-slate-800">
            {list.map((item) => (
              <li
                key={item.id}
                className={cn('flex items-center gap-3 py-3', !item.isActive && 'opacity-60')}
              >
                <CategoryIcon icon={item.category.icon} color={item.category.color} />
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium">{item.note ?? item.category.name}</p>
                  <p className="truncate text-sm text-slate-500">
                    {frequencyLabel(item.frequency)} · {item.wallet.name}
                    {' · '}
                    {item.isActive
                      ? t('recurring.nextRun', { date: formatLocalDate(item.nextRunDate) })
                      : t('recurring.stopped')}
                    {item.endDate
                      ? t('recurring.until', { date: formatLocalDate(item.endDate) })
                      : ''}
                  </p>
                </div>
                <Money
                  amount={item.amount}
                  currency={item.wallet.currencyCode}
                  tone={item.type === 'income' ? 'income' : 'expense'}
                  className="font-semibold whitespace-nowrap"
                />
                <ActiveSwitch recurring={item} />
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setEditing(item)}
                  aria-label={t('common.editItem', { name: item.note ?? item.category.name })}
                >
                  <Pencil className="size-4" aria-hidden />
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setDeleting(item)}
                  aria-label={t('common.deleteItem', { name: item.note ?? item.category.name })}
                >
                  <Trash2 className="size-4" aria-hidden />
                </Button>
              </li>
            ))}
          </ul>
        </Card>
      )}

      <RecurringFormModal
        key={editing === 'new' ? 'new' : (editing?.id ?? 'closed')}
        open={editing !== null}
        recurring={editing === 'new' ? null : editing}
        onClose={() => setEditing(null)}
      />
      <ConfirmDialog
        open={deleting !== null}
        title={t('recurring.deleteTitle')}
        message={t('recurring.deleteMessage', {
          name: deleting?.note ?? deleting?.category.name ?? '',
        })}
        loading={deleteRecurring.isPending}
        onConfirm={() => void confirmDelete()}
        onCancel={() => setDeleting(null)}
      />
    </div>
  );
}
