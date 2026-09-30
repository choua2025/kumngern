import { Router } from 'express';
import { requireAuth } from '../../middlewares/auth.js';
import { validate } from '../../middlewares/validate.js';
import { usersController } from './users.controller.js';
import { changePasswordRequest, updateProfileRequest } from './users.schema.js';

export function createUsersRouter(): Router {
  const router = Router();
  router.use(requireAuth);

  // Only /me routes: a user can never address another user's record by id.
  router.patch('/me', validate(updateProfileRequest), usersController.updateProfile);
  router.patch('/me/password', validate(changePasswordRequest), usersController.changePassword);

  return router;
}
