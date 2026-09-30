import { describe, expect, it } from 'vitest';
import { addMonths, currentMonthIn, lastDayOf, monthOf, monthToDate } from './month.js';

describe('month helpers', () => {
  it('addMonths crosses year boundaries', () => {
    expect(addMonths('2026-01', -1)).toBe('2025-12');
    expect(addMonths('2026-12', 1)).toBe('2027-01');
    expect(addMonths('2026-09', -5)).toBe('2026-04');
  });

  it('lastDayOf knows month lengths and leap years', () => {
    expect(lastDayOf('2026-02')).toBe('2026-02-28');
    expect(lastDayOf('2028-02')).toBe('2028-02-29');
    expect(lastDayOf('2026-09')).toBe('2026-09-30');
  });

  it('round-trips a DATE value', () => {
    expect(monthOf(monthToDate('2026-09'))).toBe('2026-09');
  });

  it('currentMonthIn uses the user timezone, not UTC', () => {
    const lateOnSept30Utc = new Date('2026-09-30T18:00:00Z'); // already Oct 1 in Bangkok
    expect(currentMonthIn('Asia/Bangkok', lateOnSept30Utc)).toBe('2026-10');
    expect(currentMonthIn('UTC', lateOnSept30Utc)).toBe('2026-09');
  });
});
