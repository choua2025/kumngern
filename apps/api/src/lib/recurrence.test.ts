import { describe, expect, it } from 'vitest';
import { nextOccurrence, todayIn } from './recurrence.js';

describe('nextOccurrence', () => {
  it('adds one period', () => {
    expect(nextOccurrence('2026-10-01', 'daily')).toBe('2026-10-02');
    expect(nextOccurrence('2026-12-28', 'weekly')).toBe('2027-01-04');
    expect(nextOccurrence('2026-12-15', 'monthly')).toBe('2027-01-15');
    expect(nextOccurrence('2026-10-28', 'yearly')).toBe('2027-10-28');
  });

  it('handles month ends and leap years', () => {
    expect(nextOccurrence('2028-02-28', 'daily')).toBe('2028-02-29');
    expect(nextOccurrence('2026-02-28', 'daily')).toBe('2026-03-01');
    // Safety-net clamping (the API never accepts day 29-31 for monthly/yearly)
    expect(nextOccurrence('2026-01-31', 'monthly')).toBe('2026-02-28');
    expect(nextOccurrence('2028-02-29', 'yearly')).toBe('2029-02-28');
  });
});

describe('todayIn', () => {
  it("uses the owner's timezone, not the server's", () => {
    // 2026-09-30 18:30 UTC = 2026-10-01 01:30 in Bangkok (UTC+7)
    const now = new Date('2026-09-30T18:30:00Z');
    expect(todayIn('Asia/Bangkok', now)).toBe('2026-10-01');
    expect(todayIn('UTC', now)).toBe('2026-09-30');
    expect(todayIn('America/New_York', now)).toBe('2026-09-30');
  });
});
