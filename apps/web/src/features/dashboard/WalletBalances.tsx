import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';
import { useWallets } from '../../api/wallets';
import { Money } from '../../components/Money';
import { Card, EmptyState, ErrorState, LoadingRows } from '../../components/states';
import { totalsByCurrency } from '../../lib/money';

export function WalletBalances() {
  const { t } = useTranslation();
  const wallets = useWallets();

  return (
    <Card
      title={t('dashboard.balances')}
      action={
        <Link to="/wallets" className="text-sm text-blue-600 hover:underline dark:text-blue-400">
          {t('common.manage')}
        </Link>
      }
    >
      {wallets.isPending ? (
        <LoadingRows rows={3} />
      ) : wallets.isError ? (
        <ErrorState error={wallets.error} onRetry={() => void wallets.refetch()} />
      ) : wallets.data.length === 0 ? (
        <EmptyState title={t('dashboard.noWallets')} description={t('dashboard.noWalletsHint')} />
      ) : (
        <>
          <ul className="divide-y divide-slate-100 dark:divide-slate-800">
            {wallets.data.map((wallet) => (
              <li key={wallet.id} className="flex items-center justify-between gap-3 py-2.5">
                <div className="min-w-0">
                  <p className="truncate font-medium">{wallet.name}</p>
                  <p className="text-xs text-slate-500">{t(`walletTypes.${wallet.type}`)}</p>
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
                <span className="text-slate-500">
                  {t('common.totalIn', { currency: total.currencyCode })}
                </span>
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
