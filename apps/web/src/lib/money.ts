import Big from 'big.js';

/**
 * Money arrives from the API as strings ("1250.50") and stays a string or a Big
 * in the browser — never a JS number (engineering rule 1).
 */

const formatters = new Map<string, Intl.NumberFormat>();

function formatterFor(currency: string, decimals: number): Intl.NumberFormat {
  const key = `${currency}:${decimals}`;
  let formatter = formatters.get(key);
  if (!formatter) {
    formatter = new Intl.NumberFormat('th-TH', {
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
