import { asyncHandler } from '../../lib/async-handler.js';
import type { ValidatedRequest } from '../../middlewares/validate.js';
import type { forgotPasswordRequest, resetPasswordRequest } from './password-reset.schema.js';
import { passwordResetService } from './password-reset.service.js';

export const passwordResetController = {
  /** 202 for every valid email — registered or not (no account enumeration). */
  forgot: asyncHandler<ValidatedRequest<typeof forgotPasswordRequest>>(async (req, res) => {
    await passwordResetService.requestReset(req.body);
    res.status(202).end();
  }),

  /** 204: the password is changed and every session is gone — the client logs in again. */
  reset: asyncHandler<ValidatedRequest<typeof resetPasswordRequest>>(async (req, res) => {
    await passwordResetService.resetPassword(req.body);
    res.status(204).end();
  }),
};
