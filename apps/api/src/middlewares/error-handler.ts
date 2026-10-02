import { type ErrorKey, formatMessage, isMessageRef } from '@income-expenses/shared';
import type { ErrorRequestHandler, RequestHandler } from 'express';
import { MulterError } from 'multer';
import { ZodError } from 'zod';
import { Prisma } from '../generated/prisma/client.js';
import { AppError, type ErrorDetail, errors } from '../lib/errors.js';
import { zodIssuesToDetails } from './validate.js';

/**
 * Field messages are references ("validation.amountInvalid") from the shared schemas and
 * services, or Zod's own English defaults. Send English text + the key to translate.
 */
function renderDetail(item: ErrorDetail): { path: string; message: string; key?: string } {
  return isMessageRef(item.message)
    ? { path: item.path, message: formatMessage(item.message), key: item.message }
    : item;
}

/** Errors raised by express.json() (body-parser) carry a `type` string. */
function isBodyParserError(error: unknown): error is { type: string } {
  return (
    typeof error === 'object' && error !== null && 'type' in error && typeof error.type === 'string'
  );
}

/** Upload limits from middlewares/upload.ts. Anything else is a malformed form → generic 400. */
const MULTER_MESSAGES: Partial<Record<MulterError['code'], ErrorKey>> = {
  LIMIT_FILE_SIZE: 'errors.fileTooLarge',
  LIMIT_FILE_COUNT: 'errors.tooManyFilesInRequest',
  LIMIT_UNEXPECTED_FILE: 'errors.unexpectedFileField',
};

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
        return errors.conflict('errors.duplicate');
      case 'P2003': // foreign key constraint
        return errors.conflict('errors.inUse');
      case 'P2025': // record not found
        return errors.notFound();
      default:
        return null;
    }
  }

  if (error instanceof MulterError) {
    return errors.validation(MULTER_MESSAGES[error.code] ?? 'errors.invalidUpload');
  }

  if (isBodyParserError(error)) {
    if (error.type === 'entity.parse.failed') {
      return errors.validation('errors.invalidJson');
    }
    if (error.type === 'entity.too.large') {
      return errors.validation('errors.payloadTooLarge');
    }
  }

  return null;
}

/** Any route that did not match. Registered after all routers. */
export const notFoundHandler: RequestHandler = (req, _res, next) => {
  next(errors.notFound('errors.routeNotFound', { method: req.method, path: req.path }));
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
      error: {
        code: 'INTERNAL_ERROR',
        key: 'errors.internal',
        message: formatMessage('errors.internal'),
        requestId,
      },
    });
    return;
  }

  if (appError.status >= 500) {
    req.log.error({ err: appError }, appError.message);
  }

  res.status(appError.status).json({
    error: {
      code: appError.code,
      ...(appError.key ? { key: appError.key } : {}),
      message: appError.message,
      ...(appError.details ? { details: appError.details.map(renderDetail) } : {}),
      requestId,
    },
  });
};
