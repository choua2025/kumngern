import { Link } from 'react-router-dom';
import { useWallets } from '../../api/wallets';
import { Money } from '../../components/Money';
import { Card, EmptyState, ErrorState, LoadingRows } from '../../components/states';
import { totalsByCurrency } from '../../lib/money';

const WALLET_TYPE_LABEL: Record<string, string> = {
  cash: 'เงินสด',
  bank: 'ธนาคาร',
  ewallet: 'e-wallet',
  credit_card: 'บัตรเครดิต',
  saving: 'เงินออม',
};

export function WalletBalances() {
  const wallets = useWallets();

  return (
    <Card
      title="ยอดคงเหลือทุกกระเป๋า"
      action={
        <Link to="/wallets" className="text-sm text-blue-600 hover:underline dark:text-blue-400">
          จัดการ
        </Link>
      }
    >
      {wallets.isPending ? (
        <LoadingRows rows={3} />
      ) : wallets.isError ? (
        <ErrorState error={wallets.error} onRetry={() => void wallets.refetch()} />
      ) : wallets.data.length === 0 ? (
        <EmptyState
          title="ยังไม่มีกระเป๋าเงิน"
          description="เพิ่มเงินสด บัญชีธนาคาร หรือ e-wallet ใบแรก"
        />
      ) : (
        <>
          <ul className="divide-y divide-slate-100 dark:divide-slate-800">
            {wallets.data.map((wallet) => (
              <li key={wallet.id} className="flex items-center justify-between gap-3 py-2.5">
                <div className="min-w-0">
                  <p className="truncate font-medium">{wallet.name}</p>
                  <p className="text-xs text-slate-500">
                    {WALLET_TYPE_LABEL[wallet.type] ?? wallet.type}
                  </p>
                </div>
                <Money
                  amount={wallet.balance}
                  currency={wallet.currencyCode}
                  tone="signed"
                  className="font-semibold"
                />
              </li>
            ))}
          </ul>
          {/* Totals per currency — different currencies are never added together (D7). */}
          <div className="mt-3 space-y-1 border-t border-slate-200 pt-3 dark:border-slate-700">
            {totalsByCurrency(
              wallets.data.map((w) => ({ currencyCode: w.currencyCode, amount: w.balance })),
            ).map((total) => (
              <p key={total.currencyCode} className="flex justify-between text-sm">
                <span className="text-slate-500">รวม {total.currencyCode}</span>
                <Money
                  amount={total.total}
                  currency={total.currencyCode}
                  tone="signed"
                  className="font-bold"
                />
              </p>
            ))}
          </div>
        </>
      )}
    </Card>
  );
}
