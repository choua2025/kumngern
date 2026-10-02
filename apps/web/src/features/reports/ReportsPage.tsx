import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { InputField } from '../../components/Field';
import { MonthPicker } from '../../components/MonthPicker';
import { Card } from '../../components/states';
import { cn } from '../../lib/cn';
import { addMonths, currentMonthIn, lastDayOfMonth, todayIn } from '../../lib/date';
import { useCurrentUser } from '../auth/auth-context';
import { i18n } from '../../i18n';
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
    {
      label: i18n.t('reports.thisMonth'),
      range: { from: `${month}-01`, to: lastDayOfMonth(month) },
    },
    {
      label: i18n.t('reports.lastMonth'),
      range: { from: `${lastMonth}-01`, to: lastDayOfMonth(lastMonth) },
    },
    {
      label: i18n.t('reports.last3Months'),
      range: { from: `${addMonths(month, -2)}-01`, to: todayIn(timezone) },
    },
    { label: i18n.t('reports.thisYear'), range: { from: `${year}-01-01`, to: `${year}-12-31` } },
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
  const { t } = useTranslation();
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
      <h1 className="text-2xl font-bold">{t('reports.title')}</h1>

      {/* Month view: summary + daily */}
      <section aria-label={t('reports.monthlySummary')} className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">{t('reports.monthlySummary')}</h2>
          <MonthPicker month={month} onChange={setMonth} max={currentMonth} />
        </div>
        <SummaryCards month={month} />
        <DailyChart month={month} />
      </section>

      <TrendChart
        months={trendMonths}
        title={t('reports.trend')}
        action={
          <Segmented
            label={t('reports.monthCount')}
            value={trendMonths}
            onChange={setTrendMonths}
            options={[3, 6, 12].map((n) => ({ value: n, label: t('common.months', { count: n }) }))}
          />
        }
      />

      {/* Range view: by category */}
      <Card title={t('reports.byCategoryRange')}>
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
            label={t('common.from')}
            type="date"
            value={range.from}
            onChange={(e) => setRange({ ...range, from: e.target.value })}
          />
          <InputField
            label={t('common.to')}
            type="date"
            value={range.to}
            onChange={(e) => setRange({ ...range, to: e.target.value })}
            error={rangeValid ? undefined : 'validation.dateRange'}
          />
        </div>
      </Card>
      {rangeValid && (
        <CategoryDonut
          from={range.from}
          to={range.to}
          type={categoryType}
          title={
            categoryType === 'expense'
              ? t('reports.expenseByCategory')
              : t('reports.incomeByCategory')
          }
          action={
            <Segmented
              label={t('common.type')}
              value={categoryType}
              onChange={setCategoryType}
              options={[
                { value: 'expense', label: t('common.expense') },
                { value: 'income', label: t('common.income') },
              ]}
            />
          }
        />
      )}
    </div>
  );
}
