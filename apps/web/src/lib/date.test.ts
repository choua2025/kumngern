import { describe, expect, it } from 'vitest';
import {
  addMonths,
  currentMonthIn,
  fromDateTimeLocalValue,
  lastDayOfMonth,
  toDateTimeLocalValue,
} from './date';

describe('datetime-local ↔ UTC in the user timezone', () => {
  it('round-trips Asia/Bangkok (UTC+7)', () => {
    expect(fromDateTimeLocalValue('2026-10-01T00:30', 'Asia/Bangkok')).toBe(
      '2026-09-30T17:30:00.000Z',
    );
    expect(toDateTimeLocalValue('2026-09-30T17:30:00.000Z', 'Asia/Bangkok')).toBe(
      '2026-10-01T00:30',
    );
  });

  it('handles daylight saving (America/New_York)', () => {
    expect(fromDateTimeLocalValue('2026-07-04T12:00', 'America/New_York')).toBe(
      '2026-07-04T16:00:00.000Z',
    );
    expect(fromDateTimeLocalValue('2026-01-04T12:00', 'America/New_York')).toBe(
      '2026-01-04T17:00:00.000Z',
    );
  });
});

describe('month helpers', () => {
  it('uses the user timezone for "this month"', () => {
    expect(currentMonthIn('Asia/Bangkok', new Date('2026-09-30T18:00:00Z'))).toBe('2026-10');
  });

  it('computes month ends and offsets', () => {
    expect(lastDayOfMonth('2026-02')).toBe('2026-02-28');
    expect(addMonths('2026-01', -1)).toBe('2025-12');
  });
});
