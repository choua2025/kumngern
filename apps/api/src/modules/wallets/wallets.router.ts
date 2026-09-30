import { Router } from 'express';
import { requireAuth } from '../../middlewares/auth.js';
import { validate } from '../../middlewares/validate.js';
import { walletsController } from './wallets.controller.js';
import {
  createWalletRequest,
  listWalletsRequest,
  updateWalletRequest,
  walletIdRequest,
} from './wallets.schema.js';

export function createWalletsRouter(): Router {
  const router = Router();
  router.use(requireAuth);

  router.get('/', validate(listWalletsRequest), walletsController.list);
  router.post('/', validate(createWalletRequest), walletsController.create);
  router.get('/:id', validate(walletIdRequest), walletsController.get);
  router.patch('/:id', validate(updateWalletRequest), walletsController.update);
  router.delete('/:id', validate(walletIdRequest), walletsController.delete);

  return router;
}
