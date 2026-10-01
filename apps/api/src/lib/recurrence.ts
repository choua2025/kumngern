import type { RecurringFrequency } from '@income-expenses/shared';
import { addDays } from './time.js';

const dayFormatters = new Map<string, Intl.DateTimeFormat>();

/** Today's calendar date ("2026-10-01") in `timezone` — it may already be tomorrow in Bangkok. */
export function todayIn(timezone: string, now = new Date()): string {
  let formatter = dayFormatters.get(timezone);
  if (!formatter) {
    // en-CA formats dates as YYYY-MM-DD
    formatter = new Intl.DateTimeFormat('en-CA', {
      timeZone: timezone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    });
    dayFormatters.set(timezone, formatter);
  }
  return formatter.format(now);
}

/**
 * The date of the next run after `date`. Pure calendar arithmetic.
 * Monthly/yearly clamp to the last day of a shorter month as a safety net, although
 * the API only accepts start days 1–28 for them (design-doc D8), so clamping never drifts.
 */
export function nextOccurrence(date: string, frequency: RecurringFrequency): string {
  switch (frequency) {
    case 'daily':
      return addDays(date, 1);
    case 'weekly':
      return addDays(date, 7);
    case 'monthly':
      return addMonthsClamped(date, 1);
    case 'yearly':
      return addMonthsClamped(date, 12);
  }
}

function addMonthsClamped(date: string, months: number): string {
  const [year = 0, month = 1, day = 1] = date.split('-').map(Number);
  const lastDay = new Date(Date.UTC(year, month - 1 + months + 1, 0)).getUTCDate();
  return new Date(Date.UTC(year, month - 1 + months, Math.min(day, lastDay)))
    .toISOString()
    .slice(0, 10);
}

/** DATE column value (Prisma returns midnight UTC) → "YYYY-MM-DD". */
export function dateOnly(date: Date): string {
  return date.toISOString().slice(0, 10);
}

/** "YYYY-MM-DD" → value for a DATE column. */
export function toDateColumn(date: string): Date {
  return new Date(`${date}T00:00:00Z`);
}
