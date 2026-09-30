import { z } from 'zod';

/** IDs travel as decimal strings (BIGINT does not fit in a JS number — design-doc D3). */
export const idSchema = z
  .string({ error: 'รหัสไม่ถูกต้อง' })
  .regex(/^[1-9]\d{0,17}$/, 'รหัสไม่ถูกต้อง');

const MONEY_PATTERN = /^\d{1,16}(\.\d{1,2})?$/;
const SIGNED_MONEY_PATTERN = /^-?\d{1,16}(\.\d{1,2})?$/;

/**
 * Money is a STRING with at most 2 decimals — never a JS number (engineering rule 1).
 * "12.5" and "12.50" are both accepted; the API always answers with 2 decimals.
 */
export const moneySchema = z
  .string({ error: 'กรุณากรอกจำนวนเงิน' })
  .trim()
  .regex(MONEY_PATTERN, 'จำนวนเงินไม่ถูกต้อง (ทศนิยมไม่เกิน 2 ตำแหน่ง)');

/** Strictly greater than zero — direction comes from the transaction type. */
export const positiveMoneySchema = moneySchema.refine(
  (value) => /[1-9]/.test(value),
  'จำนวนเงินต้องมากกว่า 0',
);

/** May be negative, e.g. the opening balance of a credit card. */
export const signedMoneySchema = z
  .string({ error: 'กรุณากรอกจำนวนเงิน' })
  .trim()
  .regex(SIGNED_MONEY_PATTERN, 'จำนวนเงินไม่ถูกต้อง (ทศนิยมไม่เกิน 2 ตำแหน่ง)');

/** ISO 8601 instant WITH an offset, e.g. "2026-09-30T08:15:00+07:00" or "...Z". */
export const instantSchema = z.iso.datetime({
  offset: true,
  error: 'วันเวลาต้องเป็นรูปแบบ ISO 8601 พร้อม timezone offset',
});

/** Calendar date "YYYY-MM-DD", interpreted in the user's timezone. */
export const localDateSchema = z.iso.date({ error: 'วันที่ต้องเป็นรูปแบบ YYYY-MM-DD' });

/** Hex color "#RRGGBB" (matches chk_categories_color). */
export const colorSchema = z
  .string()
  .regex(/^#[0-9A-Fa-f]{6}$/, 'สีต้องเป็นรูปแบบ #RRGGBB')
  .transform((value) => value.toUpperCase());

/** Optional free text: trimmed, and an empty string becomes null. */
export function optionalText(max: number) {
  return z
    .string()
    .trim()
    .max(max, `ยาวเกินไป (สูงสุด ${max} ตัวอักษร)`)
    .transform((value) => (value === '' ? null : value))
    .nullable()
    .optional();
}
