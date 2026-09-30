import { z } from 'zod';

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
  .string({ error: 'กรุณากรอกอีเมล' })
  .trim()
  .toLowerCase()
  .max(255, 'อีเมลยาวเกินไป')
  .pipe(z.email('รูปแบบอีเมลไม่ถูกต้อง'));

/** Rules for a NEW password. Login accepts any non-empty string (old passwords stay valid). */
export const passwordSchema = z
  .string({ error: 'กรุณากรอกรหัสผ่าน' })
  .min(8, 'รหัสผ่านต้องมีอย่างน้อย 8 ตัวอักษร')
  .refine((value) => /\p{L}/u.test(value), 'รหัสผ่านต้องมีตัวอักษรอย่างน้อย 1 ตัว')
  .refine((value) => /\d/.test(value), 'รหัสผ่านต้องมีตัวเลขอย่างน้อย 1 ตัว')
  .refine((value) => utf8ByteLength(value) <= BCRYPT_MAX_BYTES, 'รหัสผ่านยาวเกินไป');

export const displayNameSchema = z
  .string({ error: 'กรุณากรอกชื่อ' })
  .trim()
  .min(1, 'กรุณากรอกชื่อ')
  .max(100, 'ชื่อยาวเกินไป (สูงสุด 100 ตัวอักษร)');

export const currencyCodeSchema = z
  .string({ error: 'กรุณาเลือกสกุลเงิน' })
  .trim()
  .toUpperCase()
  .regex(/^[A-Z]{3}$/, 'รหัสสกุลเงินต้องเป็นตัวอักษร 3 ตัว');

export const timezoneSchema = z
  .string({ error: 'กรุณาเลือก timezone' })
  .trim()
  .min(1)
  .max(50)
  .refine(isValidTimezone, 'timezone ไม่ถูกต้อง');
