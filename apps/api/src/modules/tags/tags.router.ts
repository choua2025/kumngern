import { Router } from 'express';
import { requireAuth } from '../../middlewares/auth.js';
import { validate } from '../../middlewares/validate.js';
import { tagsController } from './tags.controller.js';
import { createTagRequest, tagIdRequest, updateTagRequest } from './tags.schema.js';

export function createTagsRouter(): Router {
  const router = Router();
  router.use(requireAuth);

  router.get('/', tagsController.list);
  router.post('/', validate(createTagRequest), tagsController.create);
  router.patch('/:id', validate(updateTagRequest), tagsController.rename);
  router.delete('/:id', validate(tagIdRequest), tagsController.delete);

  return router;
}
