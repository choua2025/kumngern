import { ChevronLeft, ChevronRight } from 'lucide-react';
import { addMonths, formatMonthLong } from '../lib/date';

/** ◀ กันยายน 2569 ▶ — with a native month input for jumping further. */
export function MonthPicker({
  month,
  onChange,
  max,
}: {
  month: string;
  onChange: (month: string) => void;
  /** Latest selectable month ("YYYY-MM"), e.g. the current month. */
  max?: string;
}) {
  const canGoNext = !max || month < max;
  return (
    <div className="flex items-center gap-1">
      <button
        type="button"
        onClick={() => onChange(addMonths(month, -1))}
        className="rounded-lg p-2 hover:bg-slate-100 dark:hover:bg-slate-800"
        aria-label="เดือนก่อนหน้า"
      >
        <ChevronLeft className="size-5" aria-hidden />
      </button>
      <label className="relative">
        <span className="min-w-36 px-2 text-center font-semibold">{formatMonthLong(month)}</span>
        <input
          type="month"
          value={month}
          max={max}
          onChange={(event) => event.target.value && onChange(event.target.value)}
          className="absolute inset-0 cursor-pointer opacity-0"
          aria-label="เลือกเดือน"
        />
      </label>
      <button
        type="button"
        onClick={() => onChange(addMonths(month, 1))}
        disabled={!canGoNext}
        className="rounded-lg p-2 hover:bg-slate-100 disabled:opacity-30 dark:hover:bg-slate-800"
        aria-label="เดือนถัดไป"
      >
        <ChevronRight className="size-5" aria-hidden />
      </button>
    </div>
  );
}
