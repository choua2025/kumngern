import type {
  BudgetStatus,
  CategoryType,
  ErrorCode,
  RecurringFrequency,
  TransactionType,
  WalletType,
} from '../constants.js';

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

export interface BudgetDto {
  id: string;
  /** "YYYY-MM" */
  month: string;
  category: CategoryRefDto;
  limitAmount: string;
  alertPercent: number;
  /** Expenses of the category AND its sub-categories, default-currency wallets only. */
  spent: string;
  /** limitAmount − spent; negative when over budget. */
  remaining: string;
  /** Rounded to 1 decimal for display; `status` is computed from the exact value. */
  usedPercent: number;
  status: BudgetStatus;
  currencyCode: string;
}

export interface CopyBudgetsResultDto {
  copied: number;
  skipped: number;
}

export interface MonthTotalsDto {
  month: string;
  income: string;
  expense: string;
  net: string;
}

export interface SummaryReportDto extends MonthTotalsDto {
  currencyCode: string;
  previous: MonthTotalsDto;
  /** null when the previous month was 0 (division by zero). */
  changePercent: { income: number | null; expense: number | null; net: number | null };
}

export interface ByCategoryReportDto {
  currencyCode: string;
  total: string;
  items: {
    category: Omit<CategoryRefDto, 'parentId'>;
    total: string;
    percent: number;
  }[];
}

export interface TrendReportDto {
  currencyCode: string;
  items: MonthTotalsDto[];
}

export interface DailyReportDto {
  currencyCode: string;
  items: { date: string; expense: string }[];
}

export interface RecurringDto {
  id: string;
  type: CategoryType;
  wallet: WalletRefDto;
  category: CategoryRefDto;
  amount: string;
  note: string | null;
  frequency: RecurringFrequency;
  /** "YYYY-MM-DD" in the owner's timezone */
  nextRunDate: string;
  endDate: string | null;
  isActive: boolean;
}
