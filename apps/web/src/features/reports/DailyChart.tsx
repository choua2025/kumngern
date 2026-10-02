import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { useDailyReport } from '../../api/reports';
import { useFormatMoney } from '../../components/Money';
import { Card, EmptyState, ErrorState, Skeleton } from '../../components/states';
import { formatDate } from '../../lib/date';
import { formatCompact, sumMoney } from '../../lib/money';

interface Row {
  day: string;
  date: string;
  expense: string;
  /** Bar height only; the tooltip shows the exact `expense` string. */
  value: number;
}

/** Single series → no legend; the title names it. Same orange as "รายจ่าย" elsewhere. */
export function DailyChart({ month, action }: { month: string; action?: ReactNode }) {
  const { t } = useTranslation();
  const daily = useDailyReport(month);
  const format = useFormatMoney();

  const rows: Row[] =
    daily.data?.items.map((item) => ({
      day: String(Number(item.date.slice(8))),
      date: item.date,
      expense: item.expense,
      value: Number(item.expense),
    })) ?? [];
  const total = sumMoney(rows.map((row) => row.expense));

  return (
    <Card title={t('reports.dailyExpense')} action={action}>
      {daily.isPending ? (
        <Skeleton className="h-64" />
      ) : daily.isError ? (
        <ErrorState error={daily.error} onRetry={() => void daily.refetch()} />
      ) : rows.every((row) => row.value === 0) ? (
        <EmptyState title={t('reports.noExpenseThisMonth')} />
      ) : (
        <>
          <p className="mb-2 text-sm text-slate-500">
            {t('reports.monthTotal')}{' '}
            <span className="font-semibold text-slate-900 dark:text-slate-100">
              {format(total, daily.data.currencyCode)}
            </span>
          </p>
          <div className="h-64 text-xs">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={rows}
                barCategoryGap={2}
                margin={{ top: 4, right: 4, bottom: 0, left: 0 }}
              >
                <CartesianGrid vertical={false} stroke="var(--chart-grid)" />
                <XAxis
                  dataKey="day"
                  tickLine={false}
                  axisLine={false}
                  interval="preserveStartEnd"
                  tick={{ fill: 'var(--chart-text)' }}
                />
                <YAxis
                  width={44}
                  tickLine={false}
                  axisLine={false}
                  tick={{ fill: 'var(--chart-text)' }}
                  tickFormatter={(value: number) => formatCompact(value)}
                />
                <Tooltip
                  cursor={{ fill: 'var(--chart-grid)', opacity: 0.5 }}
                  labelFormatter={(_label, payload) => {
                    const row = payload[0]?.payload as Row | undefined;
                    return row ? formatDate(`${row.date}T12:00:00Z`, 'UTC') : '';
                  }}
                  formatter={(_value, _name, entry) => [
                    format((entry.payload as Row).expense, daily.data.currencyCode),
                    t('common.expense'),
                  ]}
                />
                <Bar
                  dataKey="value"
                  name={t('common.expense')}
                  fill="var(--series-2)"
                  radius={[4, 4, 0, 0]}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </>
      )}
    </Card>
  );
}
