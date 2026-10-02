/**
 * Dates are shown in the USER's timezone (from their profile), not the browser's:
 * a Bangkok user travelling in Tokyo still sees their budget months cut in Bangkok time.
 * The LANGUAGE of month names and the calendar era follow the UI locale (intlLocale):
 * th-TH shows the Buddhist year 2569, en-US and lo-LA show 2026.
 */
import { intlLocale } from '../i18n';

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

/*
 * Lao: Chromium (Chrome, Edge, Android WebView) ships NO Lao Intl data and silently formats
 * "lo-LA" as English ("October 2026"). Lao dates are therefore built from CLDR's Lao month
 * names here, on every browser, using CLDR's patterns ("5 ຕ.ລ. 2026", "ຕຸລາ 2026").
 */
const LAO_MONTHS = [
  'ມັງກອນ',
  'ກຸມພາ',
  'ມີນາ',
  'ເມສາ',
  'ພຶດສະພາ',
  'ມິຖຸນາ',
  'ກໍລະກົດ',
  'ສິງຫາ',
  'ກັນຍາ',
  'ຕຸລາ',
  'ພະຈິກ',
  'ທັນວາ',
];
const LAO_MONTHS_SHORT = [
  'ມ.ກ.',
  'ກ.ພ.',
  'ມ.ນ.',
  'ມ.ສ.',
  'ພ.ພ.',
  'ມິ.ຖ.',
  'ກ.ລ.',
  'ສ.ຫ.',
  'ກ.ຍ.',
  'ຕ.ລ.',
  'ພ.ຈ.',
  'ທ.ວ.',
];

const isLao = (locale: string) => locale.startsWith('lo');

function laoDate(p: { year: number; month: number; day: number }): string {
  return `${p.day} ${LAO_MONTHS_SHORT[p.month - 1] ?? ''} ${p.year}`;
}

export function formatDate(iso: string, timezone: string): string {
  const locale = intlLocale();
  if (isLao(locale)) return laoDate(wallClockParts(new Date(iso), timezone));
  return cachedFormatter(
    `date:${locale}:${timezone}`,
    () => new Intl.DateTimeFormat(locale, { timeZone: timezone, dateStyle: 'medium' }),
  ).format(new Date(iso));
}

export function formatDateTime(iso: string, timezone: string): string {
  const locale = intlLocale();
  if (isLao(locale)) {
    const p = wallClockParts(new Date(iso), timezone);
    return `${laoDate(p)}, ${pad(p.hour)}:${pad(p.minute)}`;
  }
  return cachedFormatter(
    `datetime:${locale}:${timezone}`,
    () =>
      new Intl.DateTimeFormat(locale, {
        timeZone: timezone,
        dateStyle: 'medium',
        timeStyle: 'short',
      }),
  ).format(new Date(iso));
}

/** A calendar date with no time ("2026-10-05", e.g. a recurring run) → "5 ต.ค. 2569". */
export function formatCalendarDate(date: string): string {
  return formatDate(`${date}T00:00:00Z`, 'UTC');
}

function parseMonth(month: string): { year: number; month: number } {
  const [year = 1970, monthNumber = 1] = month.split('-').map(Number);
  return { year, month: monthNumber };
}

/** "2026-09" → "ก.ย. 69" / "Sep 26" / "ກ.ຍ. 26" (short month label for charts). */
export function formatMonthShort(month: string): string {
  const locale = intlLocale();
  if (isLao(locale)) {
    const p = parseMonth(month);
    return `${LAO_MONTHS_SHORT[p.month - 1] ?? ''} ${String(p.year).slice(-2)}`;
  }
  return cachedFormatter(
    `month-short:${locale}`,
    () => new Intl.DateTimeFormat(locale, { month: 'short', year: '2-digit', timeZone: 'UTC' }),
  ).format(new Date(`${month}-01T00:00:00Z`));
}

/** "2026-09" → "กันยายน 2569" / "September 2026" / "ກັນຍາ 2026" */
export function formatMonthLong(month: string): string {
  const locale = intlLocale();
  if (isLao(locale)) {
    const p = parseMonth(month);
    return `${LAO_MONTHS[p.month - 1] ?? ''} ${p.year}`;
  }
  return cachedFormatter(
    `month-long:${locale}`,
    () => new Intl.DateTimeFormat(locale, { month: 'long', year: 'numeric', timeZone: 'UTC' }),
  ).format(new Date(`${month}-01T00:00:00Z`));
}
