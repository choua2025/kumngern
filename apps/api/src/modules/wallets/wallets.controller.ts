import { asyncHandler } from '../../lib/async-handler.js';
import { currentUserId } from '../../middlewares/auth.js';
import type { ValidatedRequest } from '../../middlewares/validate.js';
import type {
  createWalletRequest,
  listWalletsRequest,
  updateWalletRequest,
  walletIdRequest,
} from './wallets.schema.js';
import { walletsService } from './wallets.service.js';

export const walletsController = {
  list: asyncHandler<ValidatedRequest<typeof listWalletsRequest>>(async (req, res) => {
    const wallets = await walletsService.list(currentUserId(req), req.query.includeArchived);
    res.json({ data: wallets });
  }),

  get: asyncHandler<ValidatedRequest<typeof walletIdRequest>>(async (req, res) => {
    const wallet = await walletsService.get(currentUserId(req), req.params.id);
    res.json({ data: wallet });
  }),

  create: asyncHandler<ValidatedRequest<typeof createWalletRequest>>(async (req, res) => {
    const wallet = await walletsService.create(currentUserId(req), req.body);
    res.status(201).json({ data: wallet });
  }),

  update: asyncHandler<ValidatedRequest<typeof updateWalletRequest>>(async (req, res) => {
    const wallet = await walletsService.update(currentUserId(req), req.params.id, req.body);
    res.json({ data: wallet });
  }),

  delete: asyncHandler<ValidatedRequest<typeof walletIdRequest>>(async (req, res) => {
    await walletsService.delete(currentUserId(req), req.params.id);
    res.status(204).end();
  }),
};
