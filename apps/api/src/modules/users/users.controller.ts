import type { AccessTokenResponse } from '@income-expenses/shared';
import { asyncHandler } from '../../lib/async-handler.js';
import { currentUserId } from '../../middlewares/auth.js';
import type { ValidatedRequest } from '../../middlewares/validate.js';
import { setRefreshCookie } from '../auth/auth.cookies.js';
import { authService } from '../auth/auth.service.js';
import type { changePasswordRequest, updateProfileRequest } from './users.schema.js';
import { usersService } from './users.service.js';

export const usersController = {
  updateProfile: asyncHandler<ValidatedRequest<typeof updateProfileRequest>>(async (req, res) => {
    const user = await usersService.updateProfile(currentUserId(req), req.body);
    res.json({ data: user });
  }),

  changePassword: asyncHandler<ValidatedRequest<typeof changePasswordRequest>>(async (req, res) => {
    const tokens = await authService.changePassword(currentUserId(req), req.body);
    setRefreshCookie(res, tokens.refreshToken, tokens.refreshTokenExpiresAt);
    const body: { data: AccessTokenResponse } = { data: { accessToken: tokens.accessToken } };
    res.json(body);
  }),
};
