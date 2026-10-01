import { API_PREFIX } from '@income-expenses/shared';
import cookieParser from 'cookie-parser';
import cors from 'cors';
import express, { type Express } from 'express';
import helmet from 'helmet';
import { config } from './config/index.js';
import { httpLogger } from './lib/http-logger.js';
import { errorHandler, notFoundHandler } from './middlewares/error-handler.js';
import { createRateLimiter } from './middlewares/rate-limit.js';
import { createAuthRouter } from './modules/auth/auth.router.js';
import { createBudgetsRouter } from './modules/budgets/budgets.router.js';
import { createCategoriesRouter } from './modules/categories/categories.router.js';
import { createCurrenciesRouter } from './modules/currencies/currencies.router.js';
import { healthRouter } from './modules/health/health.router.js';
import { createReportsRouter } from './modules/reports/reports.router.js';
import { createTagsRouter } from './modules/tags/tags.router.js';
import { createTransactionsRouter } from './modules/transactions/transactions.router.js';
import { createUsersRouter } from './modules/users/users.router.js';
import { createWalletsRouter } from './modules/wallets/wallets.router.js';

/**
 * Builds the Express app without listening on a port, so tests can drive it
 * with Supertest and server.ts can own the process lifecycle.
 */
export function createApp(): Express {
  const app = express();

  // Behind nginx, req.ip must come from X-Forwarded-For — but only for the known
  // number of proxy hops, otherwise a client could spoof its IP (and dodge rate limits).
  app.set('trust proxy', config.TRUST_PROXY);

  // Order matters: logging first (request id for everything below), errors last.
  app.use(httpLogger);
  app.use(helmet());
  app.use(
    cors({
      // Production is same-origin behind nginx, so the list is empty there.
      origin: config.CORS_ORIGINS.length > 0 ? config.CORS_ORIGINS : false,
      credentials: true,
    }),
  );
  app.use(express.json({ limit: '100kb' }));
  app.use(cookieParser());

  const api = express.Router();
  // Health checks are mounted before the rate limiter so monitors are never throttled.
  api.use(healthRouter);
  api.use(createRateLimiter({ windowMs: 60_000, limit: config.RATE_LIMIT_PER_MINUTE }));

  api.use('/auth', createAuthRouter());
  api.use('/users', createUsersRouter());
  api.use('/currencies', createCurrenciesRouter());
  api.use('/wallets', createWalletsRouter());
  api.use('/categories', createCategoriesRouter());
  api.use('/transactions', createTransactionsRouter());
  api.use('/budgets', createBudgetsRouter());
  api.use('/reports', createReportsRouter());
  api.use('/tags', createTagsRouter());

  app.use(API_PREFIX, api);

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
