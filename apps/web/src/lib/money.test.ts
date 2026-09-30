import { describe, expect, it } from 'vitest';
import { formatMoney, sumMoney, totalsByCurrency } from './money';

describe('formatMoney', () => {
  it('formats with the currency symbol and fixed decimals', () => {
    expect(formatMoney('1250.5', 'THB')).toBe('฿1,250.50');
    expect(formatMoney('-40', 'USD')).toMatch(/-\$40\.00|\$-40\.00/);
    expect(formatMoney('2500000.00', 'LAK', 0)).toBe('₭2,500,000');
  });

  it('keeps precision beyond what a JS number can hold', () => {
    expect(formatMoney('9007199254740993.01', 'THB')).toBe('฿9,007,199,254,740,993.01');
  });
});

describe('sumMoney', () => {
  it('adds exactly (0.1 + 0.2 = 0.30, not 0.30000000000000004)', () => {
    expect(sumMoney(['0.10', '0.20'])).toBe('0.30');
    expect(sumMoney([])).toBe('0.00');
  });
});

describe('totalsByCurrency', () => {
  it('never mixes currencies', () => {
    expect(
      totalsByCurrency([
        { currencyCode: 'THB', amount: '100.25' },
        { currencyCode: 'USD', amount: '10' },
        { currencyCode: 'THB', amount: '-0.25' },
      ]),
    ).toEqual([
      { currencyCode: 'THB', total: '100.00' },
      { currencyCode: 'USD', total: '10.00' },
    ]);
  });
});
