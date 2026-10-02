import { createHash, randomBytes } from 'node:crypto';
import jwt from 'jsonwebtoken';
import { config } from '../config/index.js';
import { errors } from './errors.js';

const ISSUER = 'income-expenses-api';
const AUDIENCE = 'income-expenses-web';
const ALGORITHM = 'HS256';

// ---------------------------------------------------------------------------
// Access token — short-lived JWT, kept in browser memory only
// ---------------------------------------------------------------------------

export function signAccessToken(userId: bigint): string {
  return jwt.sign({}, config.JWT_ACCESS_SECRET, {
    algorithm: ALGORITHM,
    subject: userId.toString(),
    issuer: ISSUER,
    audience: AUDIENCE,
    expiresIn: config.ACCESS_TOKEN_TTL_SECONDS,
  });
}

/** Returns the user id, or throws UNAUTHORIZED for any invalid/expired token. */
export function verifyAccessToken(token: string): bigint {
  let payload: string | jwt.JwtPayload;
  try {
    payload = jwt.verify(token, config.JWT_ACCESS_SECRET, {
      // Pin the algorithm: never let the token header choose it ("alg": "none" attacks).
      algorithms: [ALGORITHM],
      issuer: ISSUER,
      audience: AUDIENCE,
    });
  } catch (error) {
    if (error instanceof jwt.TokenExpiredError) {
      throw errors.unauthorized('errors.sessionExpired');
    }
    throw errors.unauthorized('errors.invalidToken');
  }

  if (typeof payload === 'string' || !payload.sub || !/^\d+$/.test(payload.sub)) {
    throw errors.unauthorized('errors.invalidToken');
  }
  return BigInt(payload.sub);
}

// ---------------------------------------------------------------------------
// Refresh token — opaque random string in an httpOnly cookie; only its hash is stored
// ---------------------------------------------------------------------------

/** 256 bits of randomness — cannot be guessed, so a fast hash is enough to store it. */
export function generateRefreshToken(): string {
  return randomBytes(32).toString('base64url');
}

/** SHA-256 hex (64 chars) — matches refresh_tokens.token_hash CHAR(64). */
export function hashRefreshToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

export function refreshTokenExpiresAt(now = new Date()): Date {
  return new Date(now.getTime() + config.REFRESH_TOKEN_TTL_DAYS * 24 * 60 * 60 * 1000);
}
