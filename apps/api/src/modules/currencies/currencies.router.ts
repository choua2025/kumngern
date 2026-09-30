import { Router } from 'express';
import { currenciesController } from './currencies.controller.js';

/** Public: the register form needs the list before the user has an account. */
export function createCurrenciesRouter(): Router {
  const router = Router();
  router.get('/', currenciesController.list);
  return router;
}
