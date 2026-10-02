import type { BudgetDto, BudgetStatus } from '@income-expenses/shared';
import Big from 'big.js';
import { AlertTriangle, CheckCircle2, OctagonAlert } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { CategoryIcon } from '../../components/CategoryIcon';
import { useFormatMoney } from '../../components/Money';
import { categoryName } from '../../lib/category-name';
import { cn } from '../../lib/cn';

/** Status is never colour alone: every state has an icon and a text label too. */
const STATUS: Record<BudgetStatus, { icon: typeof CheckCircle2; bar: string; text: string }> = {
  ok: {
    icon: CheckCircle2,
    bar: 'bg-[var(--status-good)]',
    text: 'text-emerald-700 dark:text-emerald-400',
  },
  warning: {
    icon: AlertTriangle,
    bar: 'bg-[var(--status-warning)]',
    text: 'text-amber-700 dark:text-amber-400',
  },
  over: {
    icon: OctagonAlert,
    bar: 'bg-[var(--status-critical)]',
    text: 'text-red-700 dark:text-red-400',
  },
};

export function BudgetProgress({ budget }: { budget: BudgetDto }) {
  const { t } = useTranslation();
  const format = useFormatMoney();
  const status = STATUS[budget.status];
  const statusLabel = t(`budgets.${budget.status}`);
  const StatusIcon = status.icon;
  const over = new Big(budget.remaining).lt(0);
  // The bar is capped at 100 % width; the text says by how much it is over.
  const width = Math.min(budget.usedPercent, 100);

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-3">
        <CategoryIcon icon={budget.category.icon} color={budget.category.color} size="sm" />
        <div className="min-w-0 flex-1">
          <p className="truncate font-medium">{categoryName(budget.category)}</p>
          <p className="text-sm text-slate-500 tabular-nums dark:text-slate-400">
            {format(budget.spent, budget.currencyCode)} /{' '}
            {format(budget.limitAmount, budget.currencyCode)}
          </p>
        </div>
        <span className={cn('flex items-center gap-1 text-sm font-medium', status.text)}>
          <StatusIcon className="size-4" aria-hidden />
          {statusLabel}
        </span>
      </div>

      <div
        role="progressbar"
        aria-label={t('budgets.budgetFor', { name: categoryName(budget.category) })}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={width}
        aria-valuetext={t('budgets.usedValue', {
          percent: budget.usedPercent,
          status: statusLabel,
        })}
        className="h-2.5 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-800"
      >
        <div
          className={cn('h-full rounded-full transition-[width]', status.bar)}
          style={{ width: `${width}%` }}
        />
      </div>

      <p className="flex justify-between text-xs text-slate-500 tabular-nums dark:text-slate-400">
        <span>{t('budgets.used', { percent: budget.usedPercent })}</span>
        <span className={cn(over && status.text)}>
          {over
            ? t('budgets.overBy', {
                amount: format(new Big(budget.remaining).abs().toFixed(2), budget.currencyCode),
              })
            : t('budgets.remaining', { amount: format(budget.remaining, budget.currencyCode) })}
        </span>
      </p>
    </div>
  );
}
