import type { ReactNode } from 'react';
import type { MonthTotalsDto } from '@income-expenses/shared';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { useTrendReport } from '../../api/reports';
import { useFormatMoney } from '../../components/Money';
import { Card, EmptyState, ErrorState, Skeleton } from '../../components/states';
import { formatMonthShort } from '../../lib/date';

const compact = new Intl.NumberFormat('th-TH', { notation: 'compact', maximumFractionDigits: 1 });

interface Row {
  label: string;
  source: MonthTotalsDto;
  /** Chart geometry only; tooltips read the exact strings from `source`. */
  income: number;
  expense: number;
}

export function TrendChart({
  months = 6,
  title = `รายรับ-รายจ่าย ${months} เดือน`,
  action,
}: {
  months?: number;
  title?: string;
  action?: ReactNode;
}) {
  const trend = useTrendReport(months);
  const format = useFormatMoney();

  const rows: Row[] =
    trend.data?.items.map((item) => ({
      label: formatMonthShort(item.month),
      source: item,
      income: Number(item.income),
      expense: Number(item.expense),
    })) ?? [];
  const hasData = rows.some((row) => row.income > 0 || row.expense > 0);

  return (
    <Card title={title} action={action}>
      {trend.isPending ? (
        <Skeleton className="h-64" />
      ) : trend.isError ? (
        <ErrorState error={trend.error} onRetry={() => void trend.refetch()} />
      ) : !hasData ? (
        <EmptyState title="ยังไม่มีข้อมูลย้อนหลัง" />
      ) : (
        <div className="h-64 text-xs">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={rows}
              barGap={2}
              barCategoryGap="28%"
              margin={{ top: 4, right: 4, bottom: 0, left: 0 }}
            >
              <CartesianGrid vertical={false} stroke="var(--chart-grid)" />
              <XAxis
                dataKey="label"
                tickLine={false}
                axisLine={false}
                tick={{ fill: 'var(--chart-text)' }}
              />
              <YAxis
                width={44}
                tickLine={false}
                axisLine={false}
                tick={{ fill: 'var(--chart-text)' }}
                tickFormatter={(value: number) => compact.format(value)}
              />
              <Tooltip
                cursor={{ fill: 'var(--chart-grid)', opacity: 0.5 }}
                formatter={(_value, name, entry) => {
                  const source = (entry.payload as Row).source;
                  const currency = trend.data.currencyCode;
                  return name === 'รายรับ'
                    ? [format(source.income, currency), name]
                    : [format(source.expense, currency), name];
                }}
              />
              <Legend
                iconType="circle"
                wrapperStyle={{ color: 'var(--chart-text)' }}
                // Same order as the bars (Recharts sorts legend items alphabetically by default)
                itemSorter={(item) => (item.dataKey === 'income' ? 0 : 1)}
              />
              <Bar
                dataKey="income"
                name="รายรับ"
                fill="var(--series-1)"
                radius={[4, 4, 0, 0]}
                maxBarSize={28}
              />
              <Bar
                dataKey="expense"
                name="รายจ่าย"
                fill="var(--series-2)"
                radius={[4, 4, 0, 0]}
                maxBarSize={28}
              />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </Card>
  );
}
