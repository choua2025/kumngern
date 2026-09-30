import { Link } from 'react-router-dom';
import { useBudgets } from '../../api/budgets';
import { Card, EmptyState, ErrorState, LoadingRows } from '../../components/states';
import { BudgetProgress } from '../budgets/BudgetProgress';

/** Budgets at or past their alert level, most used first. */
export function BudgetWatchlist({ month }: { month: string }) {
  const budgets = useBudgets(month);
  const atRisk = (budgets.data ?? [])
    .filter((budget) => budget.status !== 'ok')
    .sort((a, b) => b.usedPercent - a.usedPercent)
    .slice(0, 3);

  return (
    <Card
      title="งบที่ใกล้เกิน"
      action={
        <Link to="/budgets" className="text-sm text-blue-600 hover:underline dark:text-blue-400">
          ดูทั้งหมด
        </Link>
      }
    >
      {budgets.isPending ? (
        <LoadingRows rows={2} />
      ) : budgets.isError ? (
        <ErrorState error={budgets.error} onRetry={() => void budgets.refetch()} />
      ) : budgets.data.length === 0 ? (
        <EmptyState
          title="ยังไม่ได้ตั้งงบเดือนนี้"
          description="ตั้งงบรายหมวดเพื่อให้ระบบเตือนก่อนใช้เกิน"
        />
      ) : atRisk.length === 0 ? (
        <EmptyState title="ทุกหมวดยังอยู่ในงบ 🎉" />
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
