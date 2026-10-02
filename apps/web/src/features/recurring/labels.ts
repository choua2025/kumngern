import type { RecurringFrequency } from '@income-expenses/shared';
import { i18n } from '../../i18n';
import { formatCalendarDate } from '../../lib/date';

export function frequencyLabel(frequency: RecurringFrequency): string {
  return i18n.t(`frequency.${frequency}`);
}

/** "2026-10-05" (a calendar date, no timezone) → "5 ต.ค. 2569" / "Oct 5, 2026" / "5 ຕ.ລ. 2026" */
export const formatLocalDate = formatCalendarDate;
