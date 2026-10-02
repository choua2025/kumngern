import Big from 'big.js';
import { intlNumberLocale } from '../i18n';

/**
 * Money arrives from the API as strings ("1250.50") and stays a string or a Big
 * in the browser — never a JS number (engineering rule 1).
 */

const formatters = new Map<string, Intl.NumberFormat>();

function formatterFor(currency: string, decimals: number): Intl.NumberFormat {
  const locale = intlNumberLocale();
  const key = `${locale}:${currency}:${decimals}`;
  let formatter = formatters.get(key);
  if (!formatter) {
    formatter = new Intl.NumberFormat(locale, {
      style: 'currency',
      currency,
      currencyDisplay: 'narrowSymbol', // ฿ $ ₭
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
    });
    formatters.set(key, formatter);
  }
  return formatter;
}

/**
 * "1250.5" + THB → "฿1,250.50".
 * Intl.NumberFormat accepts a decimal STRING and formats it exactly (no float step).
 */
export function formatMoney(amount: string, currency: string, decimals = 2): string {
  return formatterFor(currency, decimals).format(amount as Intl.StringNumericLiteral);
}

/** Exact sum of money strings: sumMoney(['0.10', '0.20']) === '0.30'. */
export function sumMoney(amounts: string[]): string {
  return amounts.reduce((sum, amount) => sum.plus(amount), new Big(0)).toFixed(2);
}

/** Plain number in the UI locale: 1234 → "1,234". */
export function formatCount(value: number): string {
  return value.toLocaleString(intlNumberLocale());
}

const compactFormatters = new Map<string, Intl.NumberFormat>();

/** Axis labels: 12500 → "12.5K" / "1.3 หมื่น" (chart ticks only — never for money values). */
export function formatCompact(value: number): string {
  const locale = intlNumberLocale();
  let formatter = compactFormatters.get(locale);
  if (!formatter) {
    formatter = new Intl.NumberFormat(locale, { notation: 'compact', maximumFractionDigits: 1 });
    compactFormatters.set(locale, formatter);
  }
  return formatter.format(value);
}

export function isNegative(amount: string): boolean {
  return new Big(amount).lt(0);
}

/** Groups by currency and sums exactly — never add different currencies together. */
export function totalsByCurrency(
  items: { currencyCode: string; amount: string }[],
): { currencyCode: string; total: string }[] {
  const groups = new Map<string, string[]>();
  for (const item of items) {
    groups.set(item.currencyCode, [...(groups.get(item.currencyCode) ?? []), item.amount]);
  }
  return [...groups.entries()].map(([currencyCode, amounts]) => ({
    currencyCode,
    total: sumMoney(amounts),
  }));
}
