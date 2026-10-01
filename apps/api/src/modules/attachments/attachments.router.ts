import { Router } from 'express';
import { requireAuth } from '../../middlewares/auth.js';
import { validate } from '../../middlewares/validate.js';
import { attachmentsController } from './attachments.controller.js';
import { attachmentIdRequest } from './attachments.schema.js';

/** GET/DELETE /attachments/:id. Uploading lives under /transactions/:id/attachments. */
export function createAttachmentsRouter(): Router {
  const router = Router();
  router.use(requireAuth);

  router.get('/:id', validate(attachmentIdRequest), attachmentsController.download);
  router.delete('/:id', validate(attachmentIdRequest), attachmentsController.delete);

  return router;
}
