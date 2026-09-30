import { Router } from 'express';
import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { asyncHandler } from '../lib/async-handler.js';
import { errors } from '../lib/errors.js';
import { createTestApp } from '../test/create-test-app.js';
import { type ValidatedRequest, validate } from './validate.js';

const schemas = {
  params: z.object({ id: z.coerce.number().int().positive() }),
  query: z.object({ page: z.coerce.number().int().min(1).default(1) }),
  body: z.object({ amount: z.string().regex(/^\d+(\.\d{1,2})?$/, 'รูปแบบจำนวนเงินไม่ถูกต้อง') }),
};

const router = Router();
router.post(
  '/items/:id',
  validate(schemas),
  asyncHandler<ValidatedRequest<typeof schemas>>(async (req, res) => {
    await Promise.resolve();
    // Types come from the schemas: id and page are numbers here, not strings.
    res.json({ id: req.params.id, page: req.query.page, amount: req.body.amount });
  }),
);
router.get(
  '/boom',
  asyncHandler(async () => {
    await Promise.resolve();
    throw errors.conflict('ข้อมูลซ้ำ');
  }),
);
router.get(
  '/crash',
  asyncHandler(async () => {
    await Promise.resolve();
    throw new Error('database password is hunter2');
  }),
);

const app = createTestApp(router);

describe('validate middleware', () => {
  it('replaces raw input with parsed, coerced and defaulted values', async () => {
    const res = await request(app).post('/items/42').send({ amount: '120.50' });

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ id: 42, page: 1, amount: '120.50' });
  });

  it('reports every invalid part at once with field paths', async () => {
    const res = await request(app).post('/items/abc?page=0').send({ amount: 12.5 });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
    const paths = (res.body.error.details as { path: string }[]).map((d) => d.path);
    expect(paths).toEqual(expect.arrayContaining(['params.id', 'query.page', 'amount']));
  });
});

describe('asyncHandler + errorHandler', () => {
  it('turns a thrown AppError into the JSON error envelope', async () => {
    const res = await request(app).get('/boom');

    expect(res.status).toBe(409);
    expect(res.body).toEqual({
      error: { code: 'CONFLICT', message: 'ข้อมูลซ้ำ', requestId: expect.any(String) as unknown },
    });
  });

  it('hides the message of unexpected errors from the client', async () => {
    const res = await request(app).get('/crash');

    expect(res.status).toBe(500);
    expect(res.body.error.code).toBe('INTERNAL_ERROR');
    expect(JSON.stringify(res.body)).not.toContain('hunter2');
  });

  it('returns 404 in the same envelope for unknown routes', async () => {
    const res = await request(app).get('/nope');

    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('NOT_FOUND');
  });

  it('rejects malformed JSON with 400 instead of 500', async () => {
    const res = await request(app)
      .post('/items/1')
      .set('Content-Type', 'application/json')
      .send('{"amount": ');

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });
});
