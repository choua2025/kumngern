import { Router } from 'express';
import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { createTestApp } from '../test/create-test-app.js';
import { createRateLimiter } from './rate-limit.js';

describe('createRateLimiter', () => {
  it('returns 429 RATE_LIMITED with Retry-After once the limit is exceeded', async () => {
    const router = Router();
    router.use(createRateLimiter({ windowMs: 60_000, limit: 2 }));
    router.get('/ping', (_req, res) => {
      res.json({ data: 'pong' });
    });
    const app = createTestApp(router);

    await request(app).get('/ping').expect(200);
    await request(app).get('/ping').expect(200);
    const res = await request(app).get('/ping');

    expect(res.status).toBe(429);
    expect(res.body.error.code).toBe('RATE_LIMITED');
    expect(res.headers['retry-after']).toBeDefined();
  });
});
