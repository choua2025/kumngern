import type { WalletDto } from '@income-expenses/shared';
import { Archive, ArchiveRestore, ArrowLeftRight, Pencil, Plus, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';
import { errorMessage } from '../../api/errors';
import { useDeleteWallet, useUpdateWallet, useWallets } from '../../api/wallets';
import { Button } from '../../components/Button';
import { ConfirmDialog } from '../../components/ConfirmDialog';
import { Money } from '../../components/Money';
import { Card, EmptyState, ErrorState, LoadingRows } from '../../components/states';
import { useToast } from '../../components/toast';
import { cn } from '../../lib/cn';
import { totalsByCurrency } from '../../lib/money';
import { TransactionFormModal } from '../transactions/TransactionFormModal';
import { WalletFormModal } from './WalletFormModal';

export function WalletsPage() {
  const { t } = useTranslation();
  const [showArchived, setShowArchived] = useState(false);
  const wallets = useWallets(showArchived);
  const updateWallet = useUpdateWallet();
  const deleteWallet = useDeleteWallet();
  const toast = useToast();
  const [editing, setEditing] = useState<WalletDto | 'new' | null>(null);
  const [deleting, setDeleting] = useState<WalletDto | null>(null);
  const [transferOpen, setTransferOpen] = useState(false);

  const setArchived = async (wallet: WalletDto, isArchived: boolean) => {
    try {
      await updateWallet.mutateAsync({ id: wallet.id, patch: { isArchived } });
      toast.show(
        isArchived
          ? t('wallets.archived', { name: wallet.name })
          : t('wallets.unarchived', { name: wallet.name }),
      );
    } catch (error) {
      toast.show(errorMessage(error), { tone: 'error' });
    }
  };

  const confirmDelete = async () => {
    if (!deleting) return;
    try {
      await deleteWallet.mutateAsync(deleting.id);
      toast.show(t('wallets.deleted', { name: deleting.name }));
    } catch (error) {
      // 409: the wallet has history → the API message suggests archiving instead.
      toast.show(errorMessage(error), { tone: 'error' });
    } finally {
      setDeleting(null);
    }
  };

  const active = wallets.data?.filter((w) => !w.isArchived) ?? [];

  return (
    <div className="space-y-4">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold">{t('wallets.title')}</h1>
        <div className="flex gap-2">
          <Button
            variant="secondary"
            onClick={() => setTransferOpen(true)}
            disabled={active.length < 2}
          >
            <ArrowLeftRight className="size-4" aria-hidden /> {t('transactions.transferMoney')}
          </Button>
          <Button onClick={() => setEditing('new')}>
            <Plus className="size-4" aria-hidden /> {t('wallets.add')}
          </Button>
        </div>
      </header>

      {wallets.isPending ? (
        <Card>
          <LoadingRows rows={4} />
        </Card>
      ) : wallets.isError ? (
        <ErrorState error={wallets.error} onRetry={() => void wallets.refetch()} />
      ) : wallets.data.length === 0 ? (
        <EmptyState
          title={t('wallets.empty')}
          description={t('wallets.emptyHint')}
          action={<Button onClick={() => setEditing('new')}>{t('wallets.addFirst')}</Button>}
        />
      ) : (
        <>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {totalsByCurrency(
              active.map((w) => ({ currencyCode: w.currencyCode, amount: w.balance })),
            ).map((total) => (
              <Card key={total.currencyCode}>
                <p className="text-sm text-slate-500">
                  {t('wallets.totalIn', { currency: total.currencyCode })}
                </p>
                <p className="mt-1 text-2xl font-bold">
                  <Money amount={total.total} currency={total.currencyCode} tone="signed" />
                </p>
              </Card>
            ))}
          </div>

          <Card>
            <ul className="divide-y divide-slate-100 dark:divide-slate-800">
              {wallets.data.map((wallet) => (
                <li
                  key={wallet.id}
                  className={cn(
                    'flex flex-wrap items-center gap-3 py-3',
                    wallet.isArchived && 'opacity-60',
                  )}
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium">
                      {wallet.name}
                      {wallet.isArchived && (
                        <span className="ml-2 rounded bg-slate-200 px-1.5 py-0.5 text-xs dark:bg-slate-700">
                          {t('wallets.archivedBadge')}
                        </span>
                      )}
                    </p>
                    <p className="text-sm text-slate-500">
                      {t(`walletTypes.${wallet.type}`)} · {wallet.currencyCode} ·{' '}
                      <Link
                        to={`/transactions?walletId=${wallet.id}`}
                        className="text-blue-600 hover:underline dark:text-blue-400"
                      >
                        {t('wallets.viewTransactions')}
                      </Link>
                    </p>
                  </div>
                  <Money
                    amount={wallet.balance}
                    currency={wallet.currencyCode}
                    tone="signed"
                    className="text-lg font-semibold"
                  />
                  <div className="flex">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setEditing(wallet)}
                      aria-label={t('common.editItem', { name: wallet.name })}
                    >
                      <Pencil className="size-4" aria-hidden />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => void setArchived(wallet, !wallet.isArchived)}
                      aria-label={
                        wallet.isArchived
                          ? t('wallets.unarchiveItem', { name: wallet.name })
                          : t('wallets.archiveItem', { name: wallet.name })
                      }
                      title={wallet.isArchived ? t('wallets.unarchive') : t('wallets.archiveHint')}
                    >
                      {wallet.isArchived ? (
                        <ArchiveRestore className="size-4" aria-hidden />
                      ) : (
                        <Archive className="size-4" aria-hidden />
                      )}
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setDeleting(wallet)}
                      aria-label={t('common.deleteItem', { name: wallet.name })}
                    >
                      <Trash2 className="size-4" aria-hidden />
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
            <label className="mt-3 flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={showArchived}
                onChange={(e) => setShowArchived(e.target.checked)}
                className="size-4 rounded"
              />
              {t('wallets.showArchived')}
            </label>
          </Card>
        </>
      )}

      <WalletFormModal
        key={editing === 'new' ? 'new' : (editing?.id ?? 'closed')}
        open={editing !== null}
        wallet={editing === 'new' ? null : editing}
        onClose={() => setEditing(null)}
      />
      <ConfirmDialog
        open={deleting !== null}
        title={t('wallets.deleteTitle')}
        message={t('wallets.deleteMessage', { name: deleting?.name ?? '' })}
        loading={deleteWallet.isPending}
        onConfirm={() => void confirmDelete()}
        onCancel={() => setDeleting(null)}
      />
      <TransactionFormModal
        key={transferOpen ? 'transfer-open' : 'transfer-closed'}
        open={transferOpen}
        transaction={null}
        onClose={() => setTransferOpen(false)}
      />
    </div>
  );
}
