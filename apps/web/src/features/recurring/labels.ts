import type { RecurringFrequency } from '@income-expenses/shared';

export const FREQUENCY_LABELS: Record<RecurringFrequency, string> = {
  daily: 'ทุกวัน',
  weekly: 'ทุกสัปดาห์',
  monthly: 'ทุกเดือน',
  yearly: 'ทุกปี',
};

/** "2026-10-05" (a calendar date, no timezone) → "5 ต.ค. 2569" */
export function formatLocalDate(date: string): string {
  return new Intl.DateTimeFormat('th-TH', { dateStyle: 'medium', timeZone: 'UTC' }).format(
    new Date(`${date}T00:00:00Z`),
  );
}
