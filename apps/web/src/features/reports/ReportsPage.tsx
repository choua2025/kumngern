import { useState } from 'react';
import { InputField } from '../../components/Field';
import { MonthPicker } from '../../components/MonthPicker';
import { Card } from '../../components/states';
import { cn } from '../../lib/cn';
import { addMonths, currentMonthIn, lastDayOfMonth, todayIn } from '../../lib/date';
import { useCurrentUser } from '../auth/auth-context';
import { CategoryDonut } from '../dashboard/CategoryDonut';
import { SummaryCards } from '../dashboard/SummaryCards';
import { TrendChart } from '../dashboard/TrendChart';
import { DailyChart } from './DailyChart';

interface Range {
  from: string;
  to: string;
}

function presets(timezone: string): { label: string; range: Range }[] {
  const month = currentMonthIn(timezone);
  const lastMonth = addMonths(month, -1);
  const year = month.slice(0, 4);
  return [
    { label: 'เดือนนี้', range: { from: `${month}-01`, to: lastDayOfMonth(month) } },
    { label: 'เดือนที่แล้ว', range: { from: `${lastMonth}-01`, to: lastDayOfMonth(lastMonth) } },
    {
      label: '3 เดือนล่าสุด',
      range: { from: `${addMonths(month, -2)}-01`, to: todayIn(timezone) },
    },
    { label: 'ปีนี้', range: { from: `${year}-01-01`, to: `${year}-12-31` } },
  ];
}

function Segmented<T extends string | number>({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: T;
  options: { value: T; label: string }[];
  onChange: (value: T) => void;
}) {
  return (
    <div
      role="radiogroup"
      aria-label={label}
      className="inline-flex gap-1 rounded-lg bg-slate-100 p-1 dark:bg-slate-800"
    >
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          role="radio"
          aria-checked={value === option.value}
          onClick={() => onChange(option.value)}
          className={cn(
            'rounded-md px-2.5 py-1 text-xs font-medium',
            value === option.value
              ? 'bg-white shadow-sm dark:bg-slate-950'
              : 'text-slate-600 dark:text-slate-400',
          )}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}

export function ReportsPage() {
  const user = useCurrentUser();
  const presetList = presets(user.timezone);
  const [range, setRange] = useState<Range>(presetList[0]?.range ?? { from: '', to: '' });
  const [categoryType, setCategoryType] = useState<'expense' | 'income'>('expense');
  const [trendMonths, setTrendMonths] = useState(6);
  const currentMonth = currentMonthIn(user.timezone);
  const [month, setMonth] = useState(currentMonth);
  const rangeValid = range.from !== '' && range.to !== '' && range.from <= range.to;

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">รายงาน</h1>

      {/* Month view: summary + daily */}
      <section aria-label="สรุปรายเดือน" className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">สรุปรายเดือน</h2>
          <MonthPicker month={month} onChange={setMonth} max={currentMonth} />
        </div>
        <SummaryCards month={month} />
        <DailyChart month={month} />
      </section>

      <TrendChart
        months={trendMonths}
        title="แนวโน้มรายรับ-รายจ่าย"
        action={
          <Segmented
            label="จำนวนเดือน"
            value={trendMonths}
            onChange={setTrendMonths}
            options={[3, 6, 12].map((n) => ({ value: n, label: `${n} เดือน` }))}
          />
        }
      />

      {/* Range view: by category */}
      <Card title="ตามหมวดหมู่ตามช่วงวันที่">
        <div className="flex flex-wrap gap-2">
          {presetList.map((preset) => (
            <button
              key={preset.label}
              type="button"
              onClick={() => setRange(preset.range)}
              aria-pressed={range.from === preset.range.from && range.to === preset.range.to}
              className={cn(
                'rounded-full px-3 py-1 text-sm ring-1 ring-inset',
                range.from === preset.range.from && range.to === preset.range.to
                  ? 'bg-blue-600 text-white ring-blue-600'
                  : 'ring-slate-300 hover:bg-slate-50 dark:ring-slate-700 dark:hover:bg-slate-800',
              )}
            >
              {preset.label}
            </button>
          ))}
        </div>
        <div className="mt-3 grid grid-cols-2 gap-3 sm:max-w-md">
          <InputField
            label="ตั้งแต่"
            type="date"
            value={range.from}
            onChange={(e) => setRange({ ...range, from: e.target.value })}
          />
          <InputField
            label="ถึง"
            type="date"
            value={range.to}
            onChange={(e) => setRange({ ...range, to: e.target.value })}
            error={rangeValid ? undefined : 'วันที่เริ่มต้องไม่เกินวันที่สิ้นสุด'}
          />
        </div>
      </Card>
      {rangeValid && (
        <CategoryDonut
          from={range.from}
          to={range.to}
          type={categoryType}
          title={categoryType === 'expense' ? 'รายจ่ายตามหมวด' : 'รายรับตามหมวด'}
          action={
            <Segmented
              label="ประเภท"
              value={categoryType}
              onChange={setCategoryType}
              options={[
                { value: 'expense', label: 'รายจ่าย' },
                { value: 'income', label: 'รายรับ' },
              ]}
            />
          }
        />
      )}
    </div>
  );
}
