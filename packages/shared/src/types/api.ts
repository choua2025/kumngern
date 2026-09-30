import type { CategoryType, ErrorCode, TransactionType, WalletType } from '../constants.js';

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

export interface WalletDto {
  id: string;
  name: string;
  type: WalletType;
  currencyCode: string;
  initialBalance: string;
  /** initialBalance + all non-deleted transactions (v_wallet_balances). */
  balance: string;
  isArchived: boolean;
  createdAt: string;
}

export interface CategoryDto {
  id: string;
  name: string;
  type: CategoryType;
  icon: string | null;
  color: string | null;
  parentId: string | null;
  isSystem: boolean;
  children: CategoryDto[];
}

export interface WalletRefDto {
  id: string;
  name: string;
  currencyCode: string;
}

export interface CategoryRefDto {
  id: string;
  name: string;
  icon: string | null;
  color: string | null;
  parentId: string | null;
}

export interface TagRefDto {
  id: string;
  name: string;
}

export interface AttachmentDto {
  id: string;
  originalName: string;
  mimeType: string;
  sizeBytes: number;
  uploadedAt: string;
}

export interface TransactionDto {
  id: string;
  type: TransactionType;
  amount: string;
  toAmount: string | null;
  note: string | null;
  occurredAt: string;
  wallet: WalletRefDto;
  toWallet: WalletRefDto | null;
  category: CategoryRefDto | null;
  tags: TagRefDto[];
  recurringId: string | null;
  attachmentCount: number;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
}

export interface TransactionDetailDto extends TransactionDto {
  attachments: AttachmentDto[];
}
