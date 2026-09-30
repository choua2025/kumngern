import { loginSchema, registerSchema } from '@income-expenses/shared';
import type { RequestSchemas } from '../../middlewares/validate.js';

// The Zod schemas live in packages/shared so the web forms validate with the exact
// same rules. This file only binds them to the part of the request they validate.

export const registerRequest = { body: registerSchema } satisfies RequestSchemas;
export const loginRequest = { body: loginSchema } satisfies RequestSchemas;
