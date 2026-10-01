import { asyncHandler } from '../../lib/async-handler.js';
import { currentUserId } from '../../middlewares/auth.js';
import type { ValidatedRequest } from '../../middlewares/validate.js';
import type {
  createRecurringRequest,
  recurringIdRequest,
  updateRecurringRequest,
} from './recurring.schema.js';
import { recurringService } from './recurring.service.js';

export const recurringController = {
  list: asyncHandler(async (req, res) => {
    res.json({ data: await recurringService.list(currentUserId(req)) });
  }),

  create: asyncHandler<ValidatedRequest<typeof createRecurringRequest>>(async (req, res) => {
    const recurring = await recurringService.create(currentUserId(req), req.body);
    res.status(201).json({ data: recurring });
  }),

  update: asyncHandler<ValidatedRequest<typeof updateRecurringRequest>>(async (req, res) => {
    const recurring = await recurringService.update(currentUserId(req), req.params.id, req.body);
    res.json({ data: recurring });
  }),

  delete: asyncHandler<ValidatedRequest<typeof recurringIdRequest>>(async (req, res) => {
    await recurringService.delete(currentUserId(req), req.params.id);
    res.status(204).end();
  }),
};
