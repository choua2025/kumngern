import { useCurrencies } from '../api/auth';
import { cn } from '../lib/cn';
import { formatMoney, isNegative } from '../lib/money';

/** Returns a formatter that knows each currency's display decimals (LAK has 0). */
export function useFormatMoney(): (amount: string, currencyCode: string) => string {
  const { data: currencies } = useCurrencies();
  return (amount, currencyCode) => {
    const decimals = currencies?.find((c) => c.code === currencyCode)?.decimals ?? 2;
    return formatMoney(amount, currencyCode, decimals);
  };
}

interface MoneyProps {
  amount: string;
  currency: string;
  /** Colour by sign: green for money in, red for money out. */
  tone?: 'neutral' | 'income' | 'expense' | 'signed';
  className?: string;
}

export function Money({ amount, currency, tone = 'neutral', className }: MoneyProps) {
  const format = useFormatMoney();
  const negative = tone === 'expense' || (tone === 'signed' && isNegative(amount));
  const positive = tone === 'income';
  return (
    <span
      className={cn(
        'tabular-nums',
        negative && 'text-red-700 dark:text-red-400',
        positive && 'text-emerald-700 dark:text-emerald-400',
        className,
      )}
    >
      {tone === 'expense' ? '−' : tone === 'income' ? '+' : ''}
      {format(amount, currency)}
    </span>
  );
}
