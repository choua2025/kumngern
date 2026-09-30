/**
 * Calendar dates live in the USER's timezone; the database stores UTC instants.
 * These helpers convert "2026-10-01 in Asia/Bangkok" into the UTC instant at which
 * that day starts, so queries can compare against occurred_at directly (sargable,
 * uses idx_tx_user_date) instead of wrapping the column in a function.
 */

const formatters = new Map<string, Intl.DateTimeFormat>();

function formatterFor(timezone: string): Intl.DateTimeFormat {
  let formatter = formatters.get(timezone);
  if (!formatter) {
    formatter = new Intl.DateTimeFormat('en-US', {
      timeZone: timezone,
      hourCycle: 'h23',
      year: 'numeric',
      month: 'numeric',
      day: 'numeric',
      hour: 'numeric',
      minute: 'numeric',
      second: 'numeric',
    });
    formatters.set(timezone, formatter);
  }
  return formatter;
}

/** Milliseconds to ADD to a UTC instant to get the wall-clock time in `timezone`. */
function timezoneOffsetMs(utcMs: number, timezone: string): number {
  const parts: Record<string, number> = {};
  for (const part of formatterFor(timezone).formatToParts(new Date(utcMs))) {
    if (part.type !== 'literal') {
      parts[part.type] = Number(part.value);
    }
  }
  const wallClockAsUtc = Date.UTC(
    parts.year ?? 0,
    (parts.month ?? 1) - 1,
    parts.day ?? 1,
    parts.hour ?? 0,
    parts.minute ?? 0,
    parts.second ?? 0,
  );
  // Drop the milliseconds the formatter cannot show.
  return wallClockAsUtc - (utcMs - (utcMs % 1000));
}

function parseLocalDate(date: string): { year: number; month: number; day: number } {
  const [year, month, day] = date.split('-').map(Number);
  if (!year || !month || !day) {
    throw new Error(`Invalid local date: ${date}`);
  }
  return { year, month, day };
}

/**
 * UTC instant of 00:00 on `date` (YYYY-MM-DD) in `timezone`.
 * Two passes handle days where the offset changes (daylight saving time).
 */
export function startOfLocalDay(date: string, timezone: string): Date {
  const { year, month, day } = parseLocalDate(date);
  const wallClockAsUtc = Date.UTC(year, month - 1, day);
  const firstGuess = wallClockAsUtc - timezoneOffsetMs(wallClockAsUtc, timezone);
  const corrected = wallClockAsUtc - timezoneOffsetMs(firstGuess, timezone);
  return new Date(corrected);
}

/** "2026-01-31" + 1 → "2026-02-01" (pure calendar arithmetic, no timezone involved). */
export function addDays(date: string, days: number): string {
  const { year, month, day } = parseLocalDate(date);
  return new Date(Date.UTC(year, month - 1, day + days)).toISOString().slice(0, 10);
}

/** Half-open UTC range [from 00:00, day-after-to 00:00) for an inclusive local date range. */
export function localDateRangeToUtc(
  from: string | undefined,
  to: string | undefined,
  timezone: string,
): { gte?: Date; lt?: Date } {
  return {
    ...(from ? { gte: startOfLocalDay(from, timezone) } : {}),
    ...(to ? { lt: startOfLocalDay(addDays(to, 1), timezone) } : {}),
  };
}
