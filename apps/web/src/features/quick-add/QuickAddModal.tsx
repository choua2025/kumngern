import type { TransactionInput } from '@income-expenses/shared';
import { Link } from 'react-router-dom';
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
  const wallets = useWallets();
  const categories = useCategories();
  const createTransaction = useCreateTransaction();
  const toast = useToast();

  const handleSubmit = async (input: TransactionInput) => {
    await createTransaction.mutateAsync(input);
    writePreference(LAST_WALLET_KEY, input.walletId);
    toast.show('บันทึกรายการแล้ว');
    onClose();
  };

  const retry = () => {
    void wallets.refetch();
    void categories.refetch();
  };

  return (
    <Modal open={open} onClose={onClose} title="เพิ่มรายการ">
      {wallets.isPending || categories.isPending ? (
        <LoadingRows rows={4} />
      ) : wallets.isError || categories.isError ? (
        <ErrorState error={wallets.error ?? categories.error} onRetry={retry} />
      ) : wallets.data.length === 0 ? (
        <EmptyState
          title="ยังไม่มีกระเป๋าเงิน"
          description="สร้างกระเป๋าใบแรกก่อน แล้วค่อยบันทึกรายการ"
          action={
            <Link
              to="/wallets"
              onClick={onClose}
              className="text-sm font-medium text-blue-600 hover:underline"
            >
              ไปหน้ากระเป๋าเงิน
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
