import request from 'supertest';
import { afterAll, describe, expect, it } from 'vitest';
import { createApp } from './app.js';
import { lifecycle } from './lib/lifecycle.js';
import { prisma } from './lib/prisma.js';

const app = createApp();

afterAll(async () => {
  await prisma.$disconnect();
});

describe('GET /api/v1/health', () => {
  it('returns 200 with uptime and a request id', async () => {
    const res = await request(app).get('/api/v1/health');

    expect(res.status).toBe(200);
    expect(res.body.data).toEqual({ status: 'ok', uptime: expect.any(Number) as unknown });
    expect(res.headers['x-request-id']).toMatch(/^[\w-]+$/);
  });

  it('echoes a safe incoming X-Request-Id (for tracing through nginx)', async () => {
    const res = await request(app).get('/api/v1/health').set('X-Request-Id', 'trace-123');

    expect(res.headers['x-request-id']).toBe('trace-123');
  });
});

describe('GET /api/v1/ready', () => {
  it('returns 200 when the database is reachable', async () => {
    const res = await request(app).get('/api/v1/ready');

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ data: { status: 'ok' } });
  });

  it('returns 503 while shutting down so the proxy stops sending traffic', async () => {
    lifecycle.isShuttingDown = true;
    try {
      const res = await request(app).get('/api/v1/ready');

      expect(res.status).toBe(503);
      expect(res.body.error.code).toBe('INTERNAL_ERROR');
    } finally {
      lifecycle.isShuttingDown = false;
    }
  });
});

describe('security middleware', () => {
  it('sets helmet headers and hides x-powered-by', async () => {
    const res = await request(app).get('/api/v1/health');

    expect(res.headers['x-content-type-options']).toBe('nosniff');
    expect(res.headers['x-powered-by']).toBeUndefined();
  });

  it('returns the error envelope for unknown API routes', async () => {
    const res = await request(app).get('/api/v1/does-not-exist');

    expect(res.status).toBe(404);
    expect(res.body.error).toMatchObject({
      code: 'NOT_FOUND',
      requestId: expect.any(String) as unknown,
    });
  });
});
