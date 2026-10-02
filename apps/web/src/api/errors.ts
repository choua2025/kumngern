import type { ApiErrorBody, ApiErrorDetail } from '@income-expenses/shared';
import { isAxiosError } from 'axios';
import { i18n } from '../i18n';
import { translateMessage } from '../i18n/use-message';

/** Every failed API call surfaces as this one error type. */
export class ApiError extends Error {
  readonly code: string;
  readonly status: number;
  readonly details: ApiErrorDetail[];
  readonly requestId: string | undefined;

  constructor(options: {
    code: string;
    message: string;
    status: number;
    details?: ApiErrorDetail[] | undefined;
    requestId?: string | undefined;
  }) {
    super(options.message);
    this.name = 'ApiError';
    this.code = options.code;
    this.status = options.status;
    this.details = options.details ?? [];
    this.requestId = options.requestId;
  }
}

/** A key this web build does not know (e.g. from a newer API) falls back to the English text. */
function translatedOr(key: string | undefined, fallback: string): string {
  if (!key) return fallback;
  const translated = translateMessage(key);
  return translated === key ? fallback : translated;
}

function isApiErrorBody(value: unknown): value is ApiErrorBody {
  return (
    typeof value === 'object' &&
    value !== null &&
    'error' in value &&
    typeof (value as ApiErrorBody).error?.code === 'string'
  );
}

export function toApiError(error: unknown): ApiError {
  if (error instanceof ApiError) {
    return error;
  }
  if (isAxiosError(error)) {
    const body: unknown = error.response?.data;
    if (error.response && isApiErrorBody(body)) {
      // The API sends English text + a key: show the key in the user's language.
      const { key, ...rest } = body.error;
      return new ApiError({
        ...rest,
        message: translatedOr(key, rest.message),
        status: error.response.status,
      });
    }
    if (!error.response) {
      return new ApiError({
        code: 'NETWORK_ERROR',
        message: i18n.t('errors.network'),
        status: 0,
      });
    }
    return new ApiError({
      code: 'INTERNAL_ERROR',
      message: i18n.t('errors.generic'),
      status: error.response.status,
    });
  }
  return new ApiError({ code: 'UNKNOWN', message: i18n.t('errors.unexpected'), status: 0 });
}

export function errorMessage(error: unknown): string {
  return toApiError(error).message;
}
