import type { ErrorCode } from '@income-expenses/shared';

export interface ErrorDetail {
  path: string;
  message: string;
}

const STATUS_BY_CODE: Record<ErrorCode, number> = {
  VALIDATION_ERROR: 400,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  CONFLICT: 409,
  RATE_LIMITED: 429,
  INTERNAL_ERROR: 500,
};

interface AppErrorOptions {
  details?: ErrorDetail[];
  /** Override the default HTTP status of the code (e.g. 503 for readiness). */
  status?: number;
  /** Underlying error — logged on the server, never sent to the client. */
  cause?: unknown;
}

/**
 * The only error type that is allowed to reach the client with its own message.
 * Services throw it; the central error handler turns it into the JSON envelope.
 */
export class AppError extends Error {
  readonly code: ErrorCode;
  readonly status: number;
  readonly details: ErrorDetail[] | undefined;

  constructor(code: ErrorCode, message: string, options: AppErrorOptions = {}) {
    super(message, { cause: options.cause });
    this.name = 'AppError';
    this.code = code;
    this.status = options.status ?? STATUS_BY_CODE[code];
    this.details = options.details;
  }
}

/** Factories with consistent, user-facing (Thai) default messages. */
export const errors = {
  validation: (message = 'ข้อมูลไม่ถูกต้อง', details?: ErrorDetail[]) =>
    new AppError('VALIDATION_ERROR', message, details ? { details } : {}),
  unauthorized: (message = 'กรุณาเข้าสู่ระบบ') => new AppError('UNAUTHORIZED', message),
  forbidden: (message = 'ไม่มีสิทธิ์ดำเนินการนี้') => new AppError('FORBIDDEN', message),
  notFound: (message = 'ไม่พบข้อมูล') => new AppError('NOT_FOUND', message),
  conflict: (message: string) => new AppError('CONFLICT', message),
  rateLimited: (message = 'ส่งคำขอบ่อยเกินไป กรุณาลองใหม่ภายหลัง') =>
    new AppError('RATE_LIMITED', message),
};
