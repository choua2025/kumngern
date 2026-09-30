import type { AccessTokenResponse, AuthResponse } from '@income-expenses/shared';
import { asyncHandler } from '../../lib/async-handler.js';
import { currentUserId } from '../../middlewares/auth.js';
import type { ValidatedRequest } from '../../middlewares/validate.js';
import { usersService } from '../users/users.service.js';
import { clearRefreshCookie, readRefreshCookie, setRefreshCookie } from './auth.cookies.js';
import type { loginRequest, registerRequest } from './auth.schema.js';
import { authService, type Session } from './auth.service.js';

function sessionResponse(session: Session): { data: AuthResponse } {
  return { data: { user: session.user, accessToken: session.accessToken } };
}

export const authController = {
  register: asyncHandler<ValidatedRequest<typeof registerRequest>>(async (req, res) => {
    const session = await authService.register(req.body);
    setRefreshCookie(res, session.refreshToken, session.refreshTokenExpiresAt);
    res.status(201).json(sessionResponse(session));
  }),

  login: asyncHandler<ValidatedRequest<typeof loginRequest>>(async (req, res) => {
    const session = await authService.login(req.body);
    setRefreshCookie(res, session.refreshToken, session.refreshTokenExpiresAt);
    res.json(sessionResponse(session));
  }),

  refresh: asyncHandler(async (req, res) => {
    try {
      const tokens = await authService.refresh(readRefreshCookie(req));
      setRefreshCookie(res, tokens.refreshToken, tokens.refreshTokenExpiresAt);
      const body: { data: AccessTokenResponse } = { data: { accessToken: tokens.accessToken } };
      res.json(body);
    } catch (error) {
      // Drop the useless cookie, then let the central error handler send the 401.
      clearRefreshCookie(res);
      throw error;
    }
  }),

  logout: asyncHandler(async (req, res) => {
    await authService.logout(readRefreshCookie(req));
    clearRefreshCookie(res);
    res.status(204).end();
  }),

  me: asyncHandler(async (req, res) => {
    const user = await usersService.getById(currentUserId(req));
    res.json({ data: user });
  }),
};
