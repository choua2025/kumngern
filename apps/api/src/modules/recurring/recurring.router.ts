import { Router } from 'express';
import { requireAuth } from '../../middlewares/auth.js';
import { validate } from '../../middlewares/validate.js';
import { recurringController } from './recurring.controller.js';
import {
  createRecurringRequest,
  recurringIdRequest,
  updateRecurringRequest,
} from './recurring.schema.js';

export function createRecurringRouter(): Router {
  const router = Router();
  router.use(requireAuth);

  router.get('/', recurringController.list);
  router.post('/', validate(createRecurringRequest), recurringController.create);
  router.patch('/:id', validate(updateRecurringRequest), recurringController.update);
  router.delete('/:id', validate(recurringIdRequest), recurringController.delete);

  return router;
}
