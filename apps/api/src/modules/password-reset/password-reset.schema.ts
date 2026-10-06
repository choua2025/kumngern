import { forgotPasswordSchema, resetPasswordSchema } from '@income-expenses/shared';
import type { RequestSchemas } from '../../middlewares/validate.js';

export const forgotPasswordRequest = { body: forgotPasswordSchema } satisfies RequestSchemas;
export const resetPasswordRequest = { body: resetPasswordSchema } satisfies RequestSchemas;
