import { rateLimit } from 'express-rate-limit';
import { errors } from '../lib/errors.js';

interface RateLimiterOptions {
  windowMs: number;
  limit: number;
  message?: string;
}

/**
 * Per-IP rate limiter that responds through the central error handler, so a 429
 * uses the same JSON envelope as every other error.
 *
 * The in-memory store is fine for a single API container. With several replicas,
 * each would count separately — switch to a shared store (e.g. Redis) then.
 * The client IP comes from `req.ip`, which is correct only when `trust proxy`
 * matches the real number of proxies (TRUST_PROXY).
 */
export function createRateLimiter({ windowMs, limit, message }: RateLimiterOptions) {
  return rateLimit({
    windowMs,
    limit,
    standardHeaders: 'draft-8', // RateLimit + RateLimit-Policy headers (and Retry-After on 429)
    legacyHeaders: false,
    handler: (_req, _res, next) => {
      next(errors.rateLimited(message));
    },
  });
}
