import { changePasswordSchema, updateProfileSchema } from '@income-expenses/shared';
import type { RequestSchemas } from '../../middlewares/validate.js';

export const updateProfileRequest = { body: updateProfileSchema } satisfies RequestSchemas;
export const changePasswordRequest = { body: changePasswordSchema } satisfies RequestSchemas;
