import { asyncHandler } from '../../lib/async-handler.js';
import { currentUserId } from '../../middlewares/auth.js';
import type { ValidatedRequest } from '../../middlewares/validate.js';
import type { createTagRequest, tagIdRequest, updateTagRequest } from './tags.schema.js';
import { tagsService } from './tags.service.js';

export const tagsController = {
  list: asyncHandler(async (req, res) => {
    res.json({ data: await tagsService.list(currentUserId(req)) });
  }),

  create: asyncHandler<ValidatedRequest<typeof createTagRequest>>(async (req, res) => {
    const tag = await tagsService.create(currentUserId(req), req.body.name);
    res.status(201).json({ data: tag });
  }),

  rename: asyncHandler<ValidatedRequest<typeof updateTagRequest>>(async (req, res) => {
    const tag = await tagsService.rename(currentUserId(req), req.params.id, req.body.name);
    res.json({ data: tag });
  }),

  delete: asyncHandler<ValidatedRequest<typeof tagIdRequest>>(async (req, res) => {
    await tagsService.delete(currentUserId(req), req.params.id);
    res.status(204).end();
  }),
};
