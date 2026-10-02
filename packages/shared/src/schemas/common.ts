import { z } from 'zod';
import { msg } from '../messages/index.js';

/** bcrypt only uses the first 72 BYTES of a password. A Thai character is 3 bytes in UTF-8. */
const BCRYPT_MAX_BYTES = 72;

const utf8ByteLength = (value: string): number => new TextEncoder().encode(value).length;

export function isValidTimezone(timezone: string): boolean {
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: timezone });
    return true;
  } catch {
    return false;
  }
}

/** Stored lower-case (docs/erd.md: chk_users_email_lower). */
export const emailSchema = z
  .string({ error: msg('validation.emailRequired') })
  .trim()
  .toLowerCase()
  .max(255, msg('validation.emailTooLong'))
  .pipe(z.email(msg('validation.emailInvalid')));

/** Rules for a NEW password. Login accepts any non-empty string (old passwords stay valid). */
export const passwordSchema = z
  .string({ error: msg('validation.passwordRequired') })
  .min(8, msg('validation.passwordMin'))
  .refine((value) => /\p{L}/u.test(value), msg('validation.passwordLetter'))
  .refine((value) => /\d/.test(value), msg('validation.passwordDigit'))
  .refine((value) => utf8ByteLength(value) <= BCRYPT_MAX_BYTES, msg('validation.passwordTooLong'));

export const displayNameSchema = z
  .string({ error: msg('validation.nameRequired') })
  .trim()
  .min(1, msg('validation.nameRequired'))
  .max(100, msg('validation.nameTooLong', { max: 100 }));

export const currencyCodeSchema = z
  .string({ error: msg('validation.currencyRequired') })
  .trim()
  .toUpperCase()
  .regex(/^[A-Z]{3}$/, msg('validation.currencyFormat'));

export const timezoneSchema = z
  .string({ error: msg('validation.timezoneRequired') })
  .trim()
  .min(1)
  .max(50)
  .refine(isValidTimezone, msg('validation.timezoneInvalid'));
