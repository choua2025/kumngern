import { z } from 'zod';
import { msg } from '../messages/index.js';
import {
  currencyCodeSchema,
  displayNameSchema,
  emailSchema,
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
