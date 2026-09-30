import { Router } from 'express';
import { healthController } from './health.controller.js';

export const healthRouter = Router();

healthRouter.get('/health', healthController.live);
healthRouter.get('/ready', healthController.ready);
