import { asyncHandler } from '../../lib/async-handler.js';
import { currentUserId } from '../../middlewares/auth.js';
import type { ValidatedRequest } from '../../middlewares/validate.js';
import type {
  createTransactionRequest,
  listTransactionsRequest,
  transactionIdRequest,
  updateTransactionRequest,
} from './transactions.schema.js';
import { transactionsService } from './transactions.service.js';

export const transactionsController = {
  list: asyncHandler<ValidatedRequest<typeof listTransactionsRequest>>(async (req, res) => {
    const page = await transactionsService.list(currentUserId(req), req.query);
    res.json(page);
  }),

  get: asyncHandler<ValidatedRequest<typeof transactionIdRequest>>(async (req, res) => {
    const transaction = await transactionsService.get(currentUserId(req), req.params.id);
    res.json({ data: transaction });
  }),

  create: asyncHandler<ValidatedRequest<typeof createTransactionRequest>>(async (req, res) => {
    const transaction = await transactionsService.create(currentUserId(req), req.body);
    res.status(201).json({ data: transaction });
  }),

  update: asyncHandler<ValidatedRequest<typeof updateTransactionRequest>>(async (req, res) => {
    const transaction = await transactionsService.update(
      currentUserId(req),
      req.params.id,
      req.body,
    );
    res.json({ data: transaction });
  }),

  delete: asyncHandler<ValidatedRequest<typeof transactionIdRequest>>(async (req, res) => {
    await transactionsService.delete(currentUserId(req), req.params.id);
    res.status(204).end();
  }),

  restore: asyncHandler<ValidatedRequest<typeof transactionIdRequest>>(async (req, res) => {
    const transaction = await transactionsService.restore(currentUserId(req), req.params.id);
    res.json({ data: transaction });
  }),
};
