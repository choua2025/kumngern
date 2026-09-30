/** Helpers for "YYYY-MM" calendar months (no timezone involved except `currentMonthIn`). */

function parseMonth(month: string): { year: number; monthIndex: number } {
  const [year, monthNumber] = month.split('-').map(Number);
  if (!year || !monthNumber) {
    throw new Error(`Invalid month: ${month}`);
  }
  return { year, monthIndex: monthNumber - 1 };
}

/** "2026-09" → "2026-09-01" (value for a DATE column / SQL parameter). */
export function firstDayOf(month: string): string {
  return `${month}-01`;
}

/** "2026-02" → "2026-02-28" */
export function lastDayOf(month: string): string {
  const { year, monthIndex } = parseMonth(month);
  return new Date(Date.UTC(year, monthIndex + 1, 0)).toISOString().slice(0, 10);
}

/** "2026-01" + (-1) → "2025-12" */
export function addMonths(month: string, delta: number): string {
  const { year, monthIndex } = parseMonth(month);
  return new Date(Date.UTC(year, monthIndex + delta, 1)).toISOString().slice(0, 7);
}

/** DATE column value (Prisma returns midnight UTC) → "YYYY-MM". */
export function monthOf(date: Date): string {
  return date.toISOString().slice(0, 7);
}

/** DATE column value for the first day of a month. */
export function monthToDate(month: string): Date {
  return new Date(`${firstDayOf(month)}T00:00:00Z`);
}

/** The current month in the user's timezone (it may already be next month in Bangkok). */
export function currentMonthIn(timezone: string, now = new Date()): string {
  // en-CA formats dates as YYYY-MM-DD
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  })
    .format(now)
    .slice(0, 7);
}
