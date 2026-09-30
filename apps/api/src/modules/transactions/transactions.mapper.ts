import type {
  TransactionDetailDto,
  TransactionDto,
  TransactionType,
  WalletRefDto,
} from '@income-expenses/shared';
import { toMoneyString, toNullableMoneyString } from '../../lib/money.js';
import type { TransactionDetailRow, TransactionRow } from './transactions.repository.js';

function toWalletRef(wallet: { id: bigint; name: string; currencyCode: string }): WalletRefDto {
  return { id: wallet.id.toString(), name: wallet.name, currencyCode: wallet.currencyCode };
}

export function toTransactionDto(row: TransactionRow): TransactionDto {
  return {
    id: row.id.toString(),
    type: row.type as TransactionType,
    amount: toMoneyString(row.amount),
    toAmount: toNullableMoneyString(row.toAmount),
    note: row.note,
    occurredAt: row.occurredAt.toISOString(),
    wallet: toWalletRef(row.wallet),
    toWallet: row.toWallet ? toWalletRef(row.toWallet) : null,
    category: row.category
      ? {
          id: row.category.id.toString(),
          name: row.category.name,
          icon: row.category.icon,
          color: row.category.color,
          parentId: row.category.parentId?.toString() ?? null,
        }
      : null,
    tags: row.tags.map(({ tag }) => ({ id: tag.id.toString(), name: tag.name })),
    recurringId: row.recurringId?.toString() ?? null,
    attachmentCount: row._count.attachments,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    deletedAt: row.deletedAt?.toISOString() ?? null,
  };
}

export function toTransactionDetailDto(row: TransactionDetailRow): TransactionDetailDto {
  return {
    ...toTransactionDto(row),
    attachments: row.attachments.map((attachment) => ({
      id: attachment.id.toString(),
      originalName: attachment.originalName,
      mimeType: attachment.mimeType,
      sizeBytes: attachment.sizeBytes,
      uploadedAt: attachment.uploadedAt.toISOString(),
    })),
  };
}
