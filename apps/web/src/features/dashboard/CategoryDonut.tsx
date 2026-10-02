import type { ReactNode } from 'react';
import type { ByCategoryReportDto } from '@income-expenses/shared';
import Big from 'big.js';
import { useTranslation } from 'react-i18next';
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts';
import { i18n } from '../../i18n';
import { useByCategoryReport } from '../../api/reports';
import { useFormatMoney } from '../../components/Money';
import { Card, EmptyState, ErrorState, Skeleton } from '../../components/states';

/** Part-to-whole reads at a glance only with few slices: top 5 + "อื่นๆ" (≤ 6). */
const MAX_SLICES = 5;
const SERIES = [
  'var(--series-1)',
  'var(--series-2)',
  'var(--series-3)',
  'var(--series-4)',
  'var(--series-5)',
];

interface Slice {
  name: string;
  total: string;
  percent: number;
  color: string;
  /** Chart geometry only — labels always use `total` (exact string). */
  value: number;
}

export function toSlices(report: ByCategoryReportDto): Slice[] {
  const top = report.items.slice(0, MAX_SLICES);
  const rest = report.items.slice(MAX_SLICES);
  const slices: Slice[] = top.map((item, index) => ({
    name: item.category.name,
    total: item.total,
    percent: item.percent,
    color: SERIES[index] ?? 'var(--series-other)',
    value: Number(item.total),
  }));
  if (rest.length > 0) {
    const total = rest.reduce((sum, item) => sum.plus(item.total), new Big(0));
    slices.push({
      name: i18n.t('common.other'),
      total: total.toFixed(2),
      percent: Number(rest.reduce((sum, item) => sum.plus(item.percent), new Big(0)).toFixed(1)),
      color: 'var(--series-other)',
      value: total.toNumber(),
    });
  }
  return slices;
}

interface CategoryDonutProps {
  from: string;
  to: string;
  type?: 'income' | 'expense';
  title: string;
  /** Extra controls in the card header (e.g. an income/expense toggle). */
  action?: ReactNode;
}

export function CategoryDonut({ from, to, type = 'expense', title, action }: CategoryDonutProps) {
  const { t } = useTranslation();
  const report = useByCategoryReport(from, to, type);
  const format = useFormatMoney();

  return (
    <Card title={title} action={action}>
      {report.isPending ? (
        <Skeleton className="h-56" />
      ) : report.isError ? (
        <ErrorState error={report.error} onRetry={() => void report.refetch()} />
      ) : report.data.items.length === 0 ? (
        <EmptyState
          title={
            type === 'expense' ? t('dashboard.noExpenseInRange') : t('dashboard.noIncomeInRange')
          }
        />
      ) : (
        <div className="flex flex-col items-center gap-4 sm:flex-row">
          <div className="relative size-44 shrink-0">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={toSlices(report.data)}
                  dataKey="value"
                  nameKey="name"
                  innerRadius="62%"
                  outerRadius="100%"
                  startAngle={90}
                  endAngle={-270}
                  stroke="var(--chart-surface)"
                  strokeWidth={2}
                  isAnimationActive={false}
                >
                  {toSlices(report.data).map((slice) => (
                    <Cell key={slice.name} fill={slice.color} />
                  ))}
                </Pie>
                <Tooltip
                  formatter={(_value, _name, entry) => {
                    const slice = entry.payload as Slice;
                    return [
                      `${format(slice.total, report.data.currencyCode)} (${slice.percent}%)`,
                      slice.name,
                    ];
                  }}
                />
              </PieChart>
            </ResponsiveContainer>
            <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center text-center">
              <span className="text-xs text-slate-500">{t('common.total')}</span>
              <span className="text-sm font-bold tabular-nums">
                {format(report.data.total, report.data.currencyCode)}
              </span>
            </div>
          </div>
          {/* Legend doubles as the table view: identity is never colour-only. */}
          <ul className="w-full space-y-1.5 text-sm">
            {toSlices(report.data).map((slice) => (
              <li key={slice.name} className="flex items-center gap-2">
                <span
                  className="size-2.5 shrink-0 rounded-full"
                  style={{ backgroundColor: slice.color }}
                  aria-hidden
                />
                <span className="flex-1 truncate">{slice.name}</span>
                <span className="tabular-nums text-slate-600 dark:text-slate-300">
                  {format(slice.total, report.data.currencyCode)}
                </span>
                <span className="w-12 text-right tabular-nums text-slate-500">
                  {slice.percent}%
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </Card>
  );
}
