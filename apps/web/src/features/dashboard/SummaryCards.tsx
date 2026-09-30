import { ArrowDownRight, ArrowUpRight, Minus } from 'lucide-react';
import { useSummaryReport } from '../../api/reports';
import { Money } from '../../components/Money';
import { ErrorState, Skeleton } from '../../components/states';
import { cn } from '../../lib/cn';

function Change({ percent, goodWhenUp }: { percent: number | null; goodWhenUp: boolean }) {
  if (percent === null) {
    return <span className="text-xs text-slate-500">ไม่มีข้อมูลเดือนก่อน</span>;
  }
  const up = percent > 0;
  const Icon = percent === 0 ? Minus : up ? ArrowUpRight : ArrowDownRight;
  const good = percent === 0 ? null : up === goodWhenUp;
  return (
    <span
      className={cn(
        'inline-flex items-center gap-0.5 text-xs font-medium',
        good === true && 'text-emerald-700 dark:text-emerald-400',
        good === false && 'text-red-700 dark:text-red-400',
        good === null && 'text-slate-500',
      )}
    >
      <Icon className="size-3.5" aria-hidden />
      {Math.abs(percent)}% จากเดือนก่อน
    </span>
  );
}

/** Stat tiles: the number IS the chart. */
export function SummaryCards({ month }: { month: string }) {
  const summary = useSummaryReport(month);

  if (summary.isPending) {
    return (
      <div className="grid gap-3 sm:grid-cols-3" role="status" aria-label="กำลังโหลดสรุปเดือนนี้">
        {[0, 1, 2].map((i) => (
          <Skeleton key={i} className="h-28" />
        ))}
      </div>
    );
  }
  if (summary.isError) {
    return <ErrorState error={summary.error} onRetry={() => void summary.refetch()} />;
  }

  const data = summary.data;
  const tiles = [
    {
      label: 'รายรับ',
      amount: data.income,
      change: data.changePercent.income,
      goodWhenUp: true,
      tone: 'income' as const,
    },
    {
      label: 'รายจ่าย',
      amount: data.expense,
      change: data.changePercent.expense,
      goodWhenUp: false,
      tone: 'expense' as const,
    },
    {
      label: 'คงเหลือสุทธิ',
      amount: data.net,
      change: data.changePercent.net,
      goodWhenUp: true,
      tone: 'signed' as const,
    },
  ];

  return (
    <div className="grid gap-3 sm:grid-cols-3">
      {tiles.map((tile) => (
        <div
          key={tile.label}
          className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-200 dark:bg-slate-900 dark:ring-slate-800"
        >
          <p className="text-sm text-slate-500 dark:text-slate-400">{tile.label}</p>
          <p className="mt-1 text-2xl font-bold">
            <Money
              amount={tile.amount}
              currency={data.currencyCode}
              tone={tile.tone === 'signed' ? 'signed' : 'neutral'}
            />
          </p>
          <div className="mt-2">
            <Change percent={tile.change} goodWhenUp={tile.goodWhenUp} />
          </div>
        </div>
      ))}
    </div>
  );
}
