import type { TransactionInput } from '@income-expenses/shared';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';
import { useCategories } from '../../api/categories';
import { useCreateTransaction } from '../../api/transactions';
import { useWallets } from '../../api/wallets';
import { Modal } from '../../components/Modal';
import { EmptyState, ErrorState, LoadingRows } from '../../components/states';
import { useToast } from '../../components/toast';
import { readPreference, writePreference } from '../../lib/storage';
import { QuickAddForm } from './QuickAddForm';

const LAST_WALLET_KEY = 'quickAdd.lastWalletId';

export function QuickAddModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { t } = useTranslation();
  const wallets = useWallets();
  const categories = useCategories();
  const createTransaction = useCreateTransaction();
  const toast = useToast();

  const handleSubmit = async (input: TransactionInput) => {
    await createTransaction.mutateAsync(input);
    writePreference(LAST_WALLET_KEY, input.walletId);
    toast.show(t('quickAdd.saved'));
    onClose();
  };

  const retry = () => {
    void wallets.refetch();
    void categories.refetch();
  };

  return (
    <Modal open={open} onClose={onClose} title={t('quickAdd.title')}>
      {wallets.isPending || categories.isPending ? (
        <LoadingRows rows={4} />
      ) : wallets.isError || categories.isError ? (
        <ErrorState error={wallets.error ?? categories.error} onRetry={retry} />
      ) : wallets.data.length === 0 ? (
        <EmptyState
          title={t('quickAdd.noWallets')}
          description={t('quickAdd.noWalletsHint')}
          action={
            <Link
              to="/wallets"
              onClick={onClose}
              className="text-sm font-medium text-blue-600 hover:underline"
            >
              {t('quickAdd.goToWallets')}
            </Link>
          }
        />
      ) : (
        <QuickAddForm
          wallets={wallets.data}
          categories={categories.data}
          defaultWalletId={readPreference(LAST_WALLET_KEY) ?? undefined}
          onSubmit={handleSubmit}
        />
      )}
    </Modal>
  );
}
