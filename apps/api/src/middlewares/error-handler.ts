import type { ErrorRequestHandler, RequestHandler } from 'express';
import { ZodError } from 'zod';
import { Prisma } from '../generated/prisma/client.js';
import { AppError, errors } from '../lib/errors.js';
import { zodIssuesToDetails } from './validate.js';

/** Errors raised by express.json() (body-parser) carry a `type` string. */
function isBodyParserError(error: unknown): error is { type: string } {
  return (
    typeof error === 'object' && error !== null && 'type' in error && typeof error.type === 'string'
  );
}

/** Maps known error types to an AppError. Returns null for unexpected errors. */
function toAppError(error: unknown): AppError | null {
  if (error instanceof AppError) {
    return error;
  }

  if (error instanceof ZodError) {
    return errors.validation(undefined, zodIssuesToDetails(error.issues));
  }

  // Safety net: services should check these cases first and throw a clearer message,
  // but a race condition (two requests at once) can still hit the database constraint.
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    switch (error.code) {
      case 'P2002': // unique constraint
        return errors.conflict('ข้อมูลนี้มีอยู่แล้ว');
      case 'P2003': // foreign key constraint
        return errors.conflict('ข้อมูลนี้ถูกใช้งานอยู่');
      case 'P2025': // record not found
        return errors.notFound();
      default:
        return null;
    }
  }

  if (isBodyParserError(error)) {
    if (error.type === 'entity.parse.failed') {
      return errors.validation('รูปแบบ JSON ไม่ถูกต้อง');
    }
    if (error.type === 'entity.too.large') {
      return errors.validation('ข้อมูลที่ส่งมีขนาดใหญ่เกินไป');
    }
  }

  return null;
}

/** Any route that did not match. Registered after all routers. */
export const notFoundHandler: RequestHandler = (req, _res, next) => {
  next(errors.notFound(`ไม่พบ ${req.method} ${req.path}`));
};

/**
 * The single place that turns errors into HTTP responses (engineering rule 7).
 * Unexpected errors are logged with their stack trace, but the client only gets a
 * generic message + requestId — internal details must never leak.
 */
export const errorHandler: ErrorRequestHandler = (error: unknown, req, res, next) => {
  if (res.headersSent) {
    // Too late to send JSON (e.g. a stream failed midway) — let Express close the socket.
    next(error);
    return;
  }

  const appError = toAppError(error);
  // genReqId in http-logger always returns a string.
  const requestId = typeof req.id === 'string' ? req.id : 'unknown';

  if (!appError) {
    req.log.error({ err: error }, 'Unhandled error');
    res.status(500).json({
      error: { code: 'INTERNAL_ERROR', message: 'เกิดข้อผิดพลาดภายในระบบ', requestId },
    });
    return;
  }

  if (appError.status >= 500) {
    req.log.error({ err: appError }, appError.message);
  }

  res.status(appError.status).json({
    error: {
      code: appError.code,
      message: appError.message,
      ...(appError.details ? { details: appError.details } : {}),
      requestId,
    },
  });
};
