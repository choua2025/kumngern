import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';
import { useTransactions } from '../../api/transactions';
import { Card, EmptyState, ErrorState, LoadingRows } from '../../components/states';
import { currentMonthIn, formatMonthLong, lastDayOfMonth } from '../../lib/date';
import { useCurrentUser } from '../auth/auth-context';
import { TransactionItem } from '../transactions/TransactionItem';
import { BudgetWatchlist } from './BudgetWatchlist';
import { CategoryDonut } from './CategoryDonut';
import { SummaryCards } from './SummaryCards';
import { TrendChart } from './TrendChart';
import { WalletBalances } from './WalletBalances';

function RecentTransactions({ timezone }: { timezone: string }) {
  const { t } = useTranslation();
  const recent = useTransactions({ limit: 5 });
  return (
    <Card
      title={t('dashboard.recent')}
      action={
        <Link
          to="/transactions"
          className="text-sm text-blue-600 hover:underline dark:text-blue-400"
        >
          {t('common.viewAll')}
        </Link>
      }
    >
      {recent.isPending ? (
        <LoadingRows rows={5} />
      ) : recent.isError ? (
        <ErrorState error={recent.error} onRetry={() => void recent.refetch()} />
      ) : recent.data.data.length === 0 ? (
        <EmptyState
          title={t('dashboard.noTransactions')}
          description={t('dashboard.noTransactionsHint')}
        />
      ) : (
        <ul className="divide-y divide-slate-100 dark:divide-slate-800">
          {recent.data.data.map((tx) => (
            <TransactionItem key={tx.id} transaction={tx} timezone={timezone} />
          ))}
        </ul>
      )}
    </Card>
  );
}

export function DashboardPage() {
  const { t } = useTranslation();
  const user = useCurrentUser();
  // "This month" in the user's timezone — not the browser's, not UTC.
  const month = currentMonthIn(user.timezone);

  return (
    <div className="space-y-4">
      <header>
        <p className="text-sm text-slate-500 dark:text-slate-400">
          {t('dashboard.greeting', { name: user.displayName })}
        </p>
        <h1 className="text-2xl font-bold">{formatMonthLong(month)}</h1>
      </header>
      <SummaryCards month={month} />
      <div className="grid gap-4 lg:grid-cols-2">
        <WalletBalances />
        <BudgetWatchlist month={month} />
        <CategoryDonut
          from={`${month}-01`}
          to={lastDayOfMonth(month)}
          title={t('dashboard.expenseByCategory')}
        />
        <TrendChart />
      </div>
      <RecentTransactions timezone={user.timezone} />
    </div>
  );
}
