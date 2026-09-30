import type { Request, RequestHandler } from 'express';
import { errors } from '../lib/errors.js';
import { verifyAccessToken } from '../lib/tokens.js';

const BEARER_PATTERN = /^Bearer ([\w-]+\.[\w-]+\.[\w-]+)$/;

/**
 * Stateless check: the signature proves who the user is, no database lookup.
 * Trade-off: a deleted user's token keeps working until it expires (max 15 min).
 */
export const requireAuth: RequestHandler = (req, _res, next) => {
  const match = BEARER_PATTERN.exec(req.headers.authorization ?? '');
  if (!match?.[1]) {
    next(errors.unauthorized());
    return;
  }
  try {
    req.user = { id: verifyAccessToken(match[1]) };
    next();
  } catch (error) {
    next(error);
  }
};

/**
 * For handlers behind `requireAuth`. Throws instead of returning undefined.
 * Takes only `user` so it accepts any validated request type (params may be bigint).
 */
export function currentUserId(req: Pick<Request, 'user'>): bigint {
  if (!req.user) {
    throw errors.unauthorized();
  }
  return req.user.id;
}
