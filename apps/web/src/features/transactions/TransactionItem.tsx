import type { TransactionDto } from '@income-expenses/shared';
import type { ReactNode } from 'react';
import { CategoryIcon } from '../../components/CategoryIcon';
import { i18n } from '../../i18n';
import { Money } from '../../components/Money';
import { formatDateTime } from '../../lib/date';

export function transactionTitle(tx: TransactionDto): string {
  if (tx.type === 'transfer') {
    return i18n.t('transactions.transferTitle', {
      from: tx.wallet.name,
      to: tx.toWallet?.name ?? '',
    });
  }
  return tx.category?.name ?? '-';
}

/** One transaction as a list row (dashboard, mobile list). */
export function TransactionItem({
  transaction: tx,
  timezone,
  actions,
}: {
  transaction: TransactionDto;
  timezone: string;
  actions?: ReactNode;
}) {
  const tone = tx.type === 'income' ? 'income' : tx.type === 'expense' ? 'expense' : 'neutral';
  return (
    <li className="flex items-center gap-3 py-3">
      <CategoryIcon
        icon={tx.type === 'transfer' ? 'transfer' : (tx.category?.icon ?? null)}
        color={tx.type === 'transfer' ? '#64748b' : (tx.category?.color ?? null)}
      />
      <div className="min-w-0 flex-1">
        <p className="truncate font-medium">{transactionTitle(tx)}</p>
        <p className="truncate text-sm text-slate-500 dark:text-slate-400">
          {formatDateTime(tx.occurredAt, timezone)}
          {tx.type !== 'transfer' && ` · ${tx.wallet.name}`}
          {tx.note && ` · ${tx.note}`}
        </p>
      </div>
      <div className="text-right">
        <Money
          amount={tx.amount}
          currency={tx.wallet.currencyCode}
          tone={tone}
          className="font-semibold"
        />
        {tx.toAmount && tx.toWallet && (
          <p className="text-xs text-slate-500">
            → <Money amount={tx.toAmount} currency={tx.toWallet.currencyCode} />
          </p>
        )}
      </div>
      {actions}
    </li>
  );
}
