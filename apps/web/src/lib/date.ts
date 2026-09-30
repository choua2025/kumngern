/**
 * Dates are shown in the USER's timezone (from their profile), not the browser's:
 * a Bangkok user travelling in Tokyo still sees their budget months cut in Bangkok time.
 */

const formatterCache = new Map<string, Intl.DateTimeFormat>();

function cachedFormatter(key: string, create: () => Intl.DateTimeFormat): Intl.DateTimeFormat {
  let formatter = formatterCache.get(key);
  if (!formatter) {
    formatter = create();
    formatterCache.set(key, formatter);
  }
  return formatter;
}

function wallClockParts(date: Date, timezone: string) {
  const formatter = cachedFormatter(
    `parts:${timezone}`,
    () =>
      new Intl.DateTimeFormat('en-US', {
        timeZone: timezone,
        hourCycle: 'h23',
        year: 'numeric',
        month: 'numeric',
        day: 'numeric',
        hour: 'numeric',
        minute: 'numeric',
        second: 'numeric',
      }),
  );
  const parts: Record<string, number> = {};
  for (const part of formatter.formatToParts(date)) {
    if (part.type !== 'literal') parts[part.type] = Number(part.value);
  }
  return {
    year: parts.year ?? 1970,
    month: parts.month ?? 1,
    day: parts.day ?? 1,
    hour: parts.hour ?? 0,
    minute: parts.minute ?? 0,
    second: parts.second ?? 0,
  };
}

const pad = (value: number) => String(value).padStart(2, '0');

/** "2026-09-30" in the user's timezone. */
export function todayIn(timezone: string, now = new Date()): string {
  const p = wallClockParts(now, timezone);
  return `${p.year}-${pad(p.month)}-${pad(p.day)}`;
}

/** "2026-09" in the user's timezone. */
export function currentMonthIn(timezone: string, now = new Date()): string {
  return todayIn(timezone, now).slice(0, 7);
}

export function lastDayOfMonth(month: string): string {
  const [year, monthNumber] = month.split('-').map(Number);
  return new Date(Date.UTC(year ?? 1970, monthNumber ?? 1, 0)).toISOString().slice(0, 10);
}

export function addMonths(month: string, delta: number): string {
  const [year, monthNumber] = month.split('-').map(Number);
  return new Date(Date.UTC(year ?? 1970, (monthNumber ?? 1) - 1 + delta, 1))
    .toISOString()
    .slice(0, 7);
}

/** ISO instant → value for <input type="datetime-local"> in the user's timezone. */
export function toDateTimeLocalValue(iso: string, timezone: string): string {
  const p = wallClockParts(new Date(iso), timezone);
  return `${p.year}-${pad(p.month)}-${pad(p.day)}T${pad(p.hour)}:${pad(p.minute)}`;
}

/**
 * "2026-10-01T00:30" typed by a Bangkok user → "2026-09-30T17:30:00.000Z".
 * Two passes handle daylight-saving transitions (same algorithm as the API).
 */
export function fromDateTimeLocalValue(value: string, timezone: string): string {
  const [datePart = '', timePart = '00:00'] = value.split('T');
  const [year = 1970, month = 1, day = 1] = datePart.split('-').map(Number);
  const [hour = 0, minute = 0] = timePart.split(':').map(Number);
  const wallClockAsUtc = Date.UTC(year, month - 1, day, hour, minute);

  const offsetAt = (utcMs: number) => {
    const p = wallClockParts(new Date(utcMs), timezone);
    return Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second) - utcMs;
  };
  const firstGuess = wallClockAsUtc - offsetAt(wallClockAsUtc);
  return new Date(wallClockAsUtc - offsetAt(firstGuess)).toISOString();
}

export function formatDate(iso: string, timezone: string): string {
  return cachedFormatter(
    `date:${timezone}`,
    () => new Intl.DateTimeFormat('th-TH', { timeZone: timezone, dateStyle: 'medium' }),
  ).format(new Date(iso));
}

export function formatDateTime(iso: string, timezone: string): string {
  return cachedFormatter(
    `datetime:${timezone}`,
    () =>
      new Intl.DateTimeFormat('th-TH', {
        timeZone: timezone,
        dateStyle: 'medium',
        timeStyle: 'short',
      }),
  ).format(new Date(iso));
}

/** "2026-09" → "ก.ย. 2569" (short Thai month label for charts). */
export function formatMonthShort(month: string): string {
  return cachedFormatter(
    'month-short',
    () => new Intl.DateTimeFormat('th-TH', { month: 'short', year: '2-digit', timeZone: 'UTC' }),
  ).format(new Date(`${month}-01T00:00:00Z`));
}

/** "2026-09" → "กันยายน 2569" */
export function formatMonthLong(month: string): string {
  return cachedFormatter(
    'month-long',
    () => new Intl.DateTimeFormat('th-TH', { month: 'long', year: 'numeric', timeZone: 'UTC' }),
  ).format(new Date(`${month}-01T00:00:00Z`));
}
