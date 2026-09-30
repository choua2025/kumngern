import type { ErrorCode } from '../constants.js';

/** JSON contract between api and web (docs/api.md). IDs and money are strings. */

export interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
}

export interface ApiSuccess<T> {
  data: T;
  meta?: PaginationMeta;
}

export interface ApiErrorDetail {
  path: string;
  message: string;
}

export interface ApiErrorBody {
  error: {
    code: ErrorCode;
    message: string;
    details?: ApiErrorDetail[];
    requestId?: string;
  };
}

export interface UserDto {
  id: string;
  email: string;
  displayName: string;
  defaultCurrency: string;
  timezone: string;
  createdAt: string;
}

export interface AuthResponse {
  user: UserDto;
  accessToken: string;
}

export interface AccessTokenResponse {
  accessToken: string;
}

export interface CurrencyDto {
  code: string;
  name: string;
  symbol: string;
  decimals: number;
}
