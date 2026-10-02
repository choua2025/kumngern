import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';
import { useBudgets } from '../../api/budgets';
import { Card, EmptyState, ErrorState, LoadingRows } from '../../components/states';
import { BudgetProgress } from '../budgets/BudgetProgress';

/** Budgets at or past their alert level, most used first. */
export function BudgetWatchlist({ month }: { month: string }) {
  const { t } = useTranslation();
  const budgets = useBudgets(month);
  const atRisk = (budgets.data ?? [])
    .filter((budget) => budget.status !== 'ok')
    .sort((a, b) => b.usedPercent - a.usedPercent)
    .slice(0, 3);

  return (
    <Card
      title={t('dashboard.budgetWatch')}
      action={
        <Link to="/budgets" className="text-sm text-blue-600 hover:underline dark:text-blue-400">
          {t('common.viewAll')}
        </Link>
      }
    >
      {budgets.isPending ? (
        <LoadingRows rows={2} />
      ) : budgets.isError ? (
        <ErrorState error={budgets.error} onRetry={() => void budgets.refetch()} />
      ) : budgets.data.length === 0 ? (
        <EmptyState title={t('dashboard.noBudget')} description={t('dashboard.noBudgetHint')} />
      ) : atRisk.length === 0 ? (
        <EmptyState title={t('dashboard.allWithinBudget')} />
      ) : (
        <div className="space-y-5">
          {atRisk.map((budget) => (
            <BudgetProgress key={budget.id} budget={budget} />
          ))}
        </div>
      )}
    </Card>
  );
}
