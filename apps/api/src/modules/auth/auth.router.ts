import { Router } from 'express';
import { config } from '../../config/index.js';
import { requireAuth } from '../../middlewares/auth.js';
import { createRateLimiter } from '../../middlewares/rate-limit.js';
import { validate } from '../../middlewares/validate.js';
import { authController } from './auth.controller.js';
import { loginRequest, registerRequest } from './auth.schema.js';

/** A factory (not a module-level router) so every app instance gets fresh rate-limit counters. */
export function createAuthRouter(): Router {
  const router = Router();

  const loginRateLimiter = createRateLimiter({
    windowMs: 60_000,
    limit: config.LOGIN_RATE_LIMIT_PER_MINUTE,
    message: 'errors.loginRateLimited',
  });

  router.post('/register', validate(registerRequest), authController.register);
  // Rate limit runs BEFORE validation so malformed requests also count as attempts.
  router.post('/login', loginRateLimiter, validate(loginRequest), authController.login);
  router.post('/refresh', authController.refresh);
  // No requireAuth: logging out must work even when the access token has expired.
  router.post('/logout', authController.logout);
  router.get('/me', requireAuth, authController.me);

  return router;
}
