import { asyncHandler } from '../../lib/async-handler.js';
import { currentUserId } from '../../middlewares/auth.js';
import type { ValidatedRequest } from '../../middlewares/validate.js';
import type {
  categoryIdRequest,
  createCategoryRequest,
  listCategoriesRequest,
  updateCategoryRequest,
} from './categories.schema.js';
import { categoriesService } from './categories.service.js';

export const categoriesController = {
  list: asyncHandler<ValidatedRequest<typeof listCategoriesRequest>>(async (req, res) => {
    const tree = await categoriesService.listTree(currentUserId(req), req.query.type);
    res.json({ data: tree });
  }),

  create: asyncHandler<ValidatedRequest<typeof createCategoryRequest>>(async (req, res) => {
    const category = await categoriesService.create(currentUserId(req), req.body);
    res.status(201).json({ data: category });
  }),

  update: asyncHandler<ValidatedRequest<typeof updateCategoryRequest>>(async (req, res) => {
    const category = await categoriesService.update(currentUserId(req), req.params.id, req.body);
    res.json({ data: category });
  }),

  delete: asyncHandler<ValidatedRequest<typeof categoryIdRequest>>(async (req, res) => {
    await categoriesService.delete(currentUserId(req), req.params.id);
    res.status(204).end();
  }),
};
