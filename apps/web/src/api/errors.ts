import type { ApiErrorBody, ApiErrorDetail } from '@income-expenses/shared';
import { isAxiosError } from 'axios';

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
      return new ApiError({ ...body.error, status: error.response.status });
    }
    if (!error.response) {
      return new ApiError({
        code: 'NETWORK_ERROR',
        message: 'เชื่อมต่อเซิร์ฟเวอร์ไม่ได้ กรุณาตรวจสอบอินเทอร์เน็ต',
        status: 0,
      });
    }
    return new ApiError({
      code: 'INTERNAL_ERROR',
      message: 'เกิดข้อผิดพลาด กรุณาลองใหม่',
      status: error.response.status,
    });
  }
  return new ApiError({ code: 'UNKNOWN', message: 'เกิดข้อผิดพลาดที่ไม่คาดคิด', status: 0 });
}

export function errorMessage(error: unknown): string {
  return toApiError(error).message;
}
