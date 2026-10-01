import { Router } from 'express';
import { requireAuth } from '../../middlewares/auth.js';
import { validate } from '../../middlewares/validate.js';
import { transactionsController } from './transactions.controller.js';
import {
  createTransactionRequest,
  exportTransactionsRequest,
  listTransactionsRequest,
  transactionIdRequest,
  updateTransactionRequest,
} from './transactions.schema.js';

export function createTransactionsRouter(): Router {
  const router = Router();
  router.use(requireAuth);

  router.get('/', validate(listTransactionsRequest), transactionsController.list);
  router.post('/', validate(createTransactionRequest), transactionsController.create);
  // Static paths must be registered BEFORE /:id, or "export.csv" would be parsed as an id.
  router.get('/export.csv', validate(exportTransactionsRequest), transactionsController.exportCsv);
  router.get('/:id', validate(transactionIdRequest), transactionsController.get);
  router.patch('/:id', validate(updateTransactionRequest), transactionsController.update);
  router.delete('/:id', validate(transactionIdRequest), transactionsController.delete);
  router.post('/:id/restore', validate(transactionIdRequest), transactionsController.restore);

  return router;
}
