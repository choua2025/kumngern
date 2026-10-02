import { z } from 'zod';
import { msg } from '../messages/index.js';

/** IDs travel as decimal strings (BIGINT does not fit in a JS number — design-doc D3). */
export const idSchema = z
  .string({ error: msg('validation.idInvalid') })
  .regex(/^[1-9]\d{0,17}$/, msg('validation.idInvalid'));

const MONEY_PATTERN = /^\d{1,16}(\.\d{1,2})?$/;
const SIGNED_MONEY_PATTERN = /^-?\d{1,16}(\.\d{1,2})?$/;

/**
 * Money is a STRING with at most 2 decimals — never a JS number (engineering rule 1).
 * "12.5" and "12.50" are both accepted; the API always answers with 2 decimals.
 */
export const moneySchema = z
  .string({ error: msg('validation.amountRequired') })
  .trim()
  .regex(MONEY_PATTERN, msg('validation.amountInvalid'));

/** Strictly greater than zero — direction comes from the transaction type. */
export const positiveMoneySchema = moneySchema.refine(
  (value) => /[1-9]/.test(value),
  msg('validation.amountPositive'),
);

/** May be negative, e.g. the opening balance of a credit card. */
export const signedMoneySchema = z
  .string({ error: msg('validation.amountRequired') })
  .trim()
  .regex(SIGNED_MONEY_PATTERN, msg('validation.amountInvalid'));

/** ISO 8601 instant WITH an offset, e.g. "2026-09-30T08:15:00+07:00" or "...Z". */
export const instantSchema = z.iso.datetime({
  offset: true,
  error: msg('validation.instantInvalid'),
});

/** Calendar date "YYYY-MM-DD", interpreted in the user's timezone. */
export const localDateSchema = z.iso.date({ error: msg('validation.dateInvalid') });

/** Hex color "#RRGGBB" (matches chk_categories_color). */
export const colorSchema = z
  .string()
  .regex(/^#[0-9A-Fa-f]{6}$/, msg('validation.colorInvalid'))
  .transform((value) => value.toUpperCase());

/** Optional free text: trimmed, and an empty string becomes null. */
export function optionalText(max: number) {
  return z
    .string()
    .trim()
    .max(max, msg('validation.tooLong', { max }))
    .transform((value) => (value === '' ? null : value))
    .nullable()
    .optional();
}
