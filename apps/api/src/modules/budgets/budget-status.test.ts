import { describe, expect, it } from 'vitest';
import { toDecimal } from '../../lib/money.js';
import { evaluateBudget } from './budget-status.js';

const evaluate = (limit: string, spent: string, alert = 80) =>
  evaluateBudget(toDecimal(limit), toDecimal(spent), alert);

describe('evaluateBudget', () => {
  it.each([
    ['0', 'ok', 0],
    ['799.99', 'ok', 80],
    ['800', 'ok', 80], // DEMO: deliberately wrong expectation to prove CI blocks the PR
    ['1000', 'warning', 100], // exactly at the limit is not "over" yet
    ['1000.01', 'over', 100],
    ['1500', 'over', 150],
  ] as const)('spent %s of 1000 → %s (%s %%)', (spent, status, usedPercent) => {
    const result = evaluate('1000', spent);

    expect(result.status).toBe(status);
    expect(result.usedPercent).toBe(usedPercent);
  });

  it('decides status on the exact value, not the rounded display value', () => {
    const result = evaluate('10000', '10004'); // 100.04 %

    expect(result.usedPercent).toBe(100);
    expect(result.status).toBe('over');
  });

  it('respects a custom alert percent', () => {
    expect(evaluate('100', '49', 50).status).toBe('ok');
    expect(evaluate('100', '50', 50).status).toBe('warning');
  });

  it('returns a negative remaining amount when over budget, without float errors', () => {
    const result = evaluate('0.30', '0.10');

    expect(result.remaining.toFixed(2)).toBe('0.20'); // 0.3 - 0.1 in JS floats = 0.19999999999999998
    expect(evaluate('100', '125.50').remaining.toFixed(2)).toBe('-25.50');
  });
});
