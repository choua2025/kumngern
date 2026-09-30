import express, { type Express, type Router } from 'express';
import { httpLogger } from '../lib/http-logger.js';
import { errorHandler, notFoundHandler } from '../middlewares/error-handler.js';

/**
 * Minimal app with the same cross-cutting middleware as the real one
 * (request id, JSON body, central error handler) for testing a single router
 * or middleware in isolation.
 */
export function createTestApp(router: Router): Express {
  const app = express();
  app.use(httpLogger);
  app.use(express.json());
  app.use(router);
  app.use(notFoundHandler);
  app.use(errorHandler);
  return app;
}
