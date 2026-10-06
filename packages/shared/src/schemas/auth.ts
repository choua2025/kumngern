import { z } from 'zod';
import { msg } from '../messages/index.js';
import {
  currencyCodeSchema,
  displayNameSchema,
  emailSchema,
  localeSchema,
  passwordSchema,
  timezoneSchema,
} from './common.js';

// z.object() strips unknown keys, so a client cannot sneak in fields such as
// `passwordHash` or `id` (mass-assignment protection).

export const registerSchema = z.object({
  email: emailSchema,
  password: passwordSchema,
  displayName: displayNameSchema,
  defaultCurrency: currencyCodeSchema,
  /** The language the visitor was using while signing up. */
  locale: localeSchema.optional(),
});
export type RegisterInput = z.infer<typeof registerSchema>;

export const loginSchema = z.object({
  email: emailSchema,
  password: z
    .string({ error: msg('validation.passwordRequired') })
    .min(1, msg('validation.passwordRequired')),
});
export type LoginInput = z.infer<typeof loginSchema>;

export const updateProfileSchema = z
  .object({
    displayName: displayNameSchema.optional(),
    defaultCurrency: currencyCodeSchema.optional(),
    timezone: timezoneSchema.optional(),
    locale: localeSchema.optional(),
  })
  .refine((value) => Object.values(value).some((field) => field !== undefined), {
    message: msg('validation.atLeastOneField'),
  });
export type UpdateProfileInput = z.infer<typeof updateProfileSchema>;

export const changePasswordSchema = z
  .object({
    currentPassword: z
      .string({ error: msg('validation.currentPasswordRequired') })
      .min(1, msg('validation.currentPasswordRequired')),
    newPassword: passwordSchema,
  })
  .refine((value) => value.currentPassword !== value.newPassword, {
    message: msg('validation.samePassword'),
    path: ['newPassword'],
  });
export type ChangePasswordInput = z.infer<typeof changePasswordSchema>;

/** Length of the one-time code emailed for a password reset. */
export const RESET_CODE_LENGTH = 6;

export const forgotPasswordSchema = z.object({ email: emailSchema });
export type ForgotPasswordInput = z.infer<typeof forgotPasswordSchema>;

export const resetPasswordSchema = z.object({
  email: emailSchema,
  code: z
    .string({ error: msg('validation.resetCodeFormat') })
    .trim()
    .regex(new RegExp(`^\\d{${RESET_CODE_LENGTH}}$`), msg('validation.resetCodeFormat')),
  newPassword: passwordSchema,
});
export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;
