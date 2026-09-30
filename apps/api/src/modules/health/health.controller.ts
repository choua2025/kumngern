import type { Request, Response } from 'express';
import { asyncHandler } from '../../lib/async-handler.js';
import { healthService } from './health.service.js';

export const healthController = {
  // Arrow functions: safe to pass as `router.get(path, healthController.live)` without `this` issues.
  live: (_req: Request, res: Response): void => {
    res.set('Cache-Control', 'no-store').json({ data: healthService.liveness() });
  },

  ready: asyncHandler(async (_req, res) => {
    await healthService.readiness();
    res.set('Cache-Control', 'no-store').json({ data: { status: 'ok' } });
  }),
};
