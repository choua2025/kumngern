import {
  type ErrorCode,
  type ErrorKey,
  formatMessage,
  isMessageRef,
  type MessageKey,
  type MessageParams,
  msg,
  type ValidationKey,
} from '@income-expenses/shared';

/**
 * `message` is a message REFERENCE ("validation.amountInvalid", "validation.tooLong?max=255")
 * or, for Zod's own defaults, plain text. The error handler renders it in English and
 * also sends the reference as `key` so the web can show it in the user's language.
 */
export interface ErrorDetail {
  path: string;
  message: string;
}

/** A field-level detail: detail('categoryId', 'validation.categoryTypeMismatch'). */
export function detail(path: string, key: ValidationKey, params?: MessageParams): ErrorDetail {
  return { path, message: msg(key, params) };
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
  /** Message reference for translation, when `ref` was one (undefined for plain text). */
  readonly key: string | undefined;

  constructor(code: ErrorCode, ref: string, options: AppErrorOptions = {}) {
    // English for logs and for API clients that do not translate.
    super(formatMessage(ref), { cause: options.cause });
    this.name = 'AppError';
    this.code = code;
    this.key = isMessageRef(ref) ? ref : undefined;
    this.status = options.status ?? STATUS_BY_CODE[code];
    this.details = options.details;
  }
}

/** Factories take message KEYS (typed), never text — a stray literal fails the build. */
export const errors = {
  validation: (
    key: MessageKey = 'validation.invalidInput',
    details?: ErrorDetail[],
    params?: MessageParams,
  ) => new AppError('VALIDATION_ERROR', msg(key, params), details ? { details } : {}),
  unauthorized: (key: ErrorKey = 'errors.unauthorized') => new AppError('UNAUTHORIZED', key),
  forbidden: (key: ErrorKey = 'errors.forbidden') => new AppError('FORBIDDEN', key),
  notFound: (key: ErrorKey = 'errors.notFound', params?: MessageParams) =>
    new AppError('NOT_FOUND', msg(key, params)),
  conflict: (key: ErrorKey, params?: MessageParams) => new AppError('CONFLICT', msg(key, params)),
  rateLimited: (key: ErrorKey = 'errors.rateLimited') => new AppError('RATE_LIMITED', key),
};
