import { API_PREFIX } from '@income-expenses/shared';
import type { CookieOptions, Request, Response } from 'express';
import { isProduction } from '../../config/index.js';

export const REFRESH_COOKIE_NAME = 'rt';

const baseOptions: CookieOptions = {
  httpOnly: true, // JavaScript (and therefore XSS) cannot read it
  secure: isProduction, // HTTPS only in production; browsers allow it on http://localhost anyway
  sameSite: 'strict', // never sent on cross-site requests → CSRF protection
  path: `${API_PREFIX}/auth`, // only sent to /auth/refresh and /auth/logout, not to every API call
};

export function setRefreshCookie(res: Response, token: string, expiresAt: Date): void {
  res.cookie(REFRESH_COOKIE_NAME, token, { ...baseOptions, expires: expiresAt });
}

/** Must use the same path/flags as when it was set, otherwise the browser keeps it. */
export function clearRefreshCookie(res: Response): void {
  res.clearCookie(REFRESH_COOKIE_NAME, baseOptions);
}

export function readRefreshCookie(req: Request): string | undefined {
  const cookies: unknown = req.cookies;
  if (typeof cookies !== 'object' || cookies === null) {
    return undefined;
  }
  const value = (cookies as Record<string, unknown>)[REFRESH_COOKIE_NAME];
  return typeof value === 'string' && value.length > 0 ? value : undefined;
}
