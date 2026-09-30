import { Router } from 'express';
import { requireAuth } from '../../middlewares/auth.js';
import { validate } from '../../middlewares/validate.js';
import { categoriesController } from './categories.controller.js';
import {
  categoryIdRequest,
  createCategoryRequest,
  listCategoriesRequest,
  updateCategoryRequest,
} from './categories.schema.js';

export function createCategoriesRouter(): Router {
  const router = Router();
  router.use(requireAuth);

  router.get('/', validate(listCategoriesRequest), categoriesController.list);
  router.post('/', validate(createCategoryRequest), categoriesController.create);
  router.patch('/:id', validate(updateCategoryRequest), categoriesController.update);
  router.delete('/:id', validate(categoryIdRequest), categoriesController.delete);

  return router;
}
