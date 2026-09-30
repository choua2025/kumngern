import {
  type ListTransactionsQuery,
  type ParsedTransactionInput,
  type PaginationMeta,
  type TransactionDetailDto,
  type TransactionDto,
  transactionInputSchema,
  type UpdateTransactionData,
} from '@income-expenses/shared';
import type { Prisma } from '../../generated/prisma/client.js';
import { type Db, runInTransaction, type TransactionRunner } from '../../lib/db.js';
import { errors } from '../../lib/errors.js';
import { toDecimal } from '../../lib/money.js';
import { escapeLikePattern, toBigIntId } from '../../lib/params.js';
import { localDateRangeToUtc } from '../../lib/time.js';
import { zodIssuesToDetails } from '../../middlewares/validate.js';
import {
  type CategoriesRepository,
  categoriesRepository,
} from '../categories/categories.repository.js';
import { type TagsRepository, tagsRepository } from '../tags/tags.repository.js';
import { type UsersRepository, usersRepository } from '../users/users.repository.js';
import { type WalletsRepository, walletsRepository } from '../wallets/wallets.repository.js';
import { toTransactionDetailDto, toTransactionDto } from './transactions.mapper.js';
import {
  type TransactionDetailRow,
  type TransactionsRepository,
  type TransactionWriteData,
  transactionsRepository,
} from './transactions.repository.js';

const TRANSACTION_NOT_FOUND = 'ไม่พบรายการ';

interface TransactionsServiceDeps {
  transactions: TransactionsRepository;
  wallets: WalletsRepository;
  categories: CategoriesRepository;
  tags: TagsRepository;
  users: UsersRepository;
  transaction: TransactionRunner;
}

function orderByFor(
  sort: ListTransactionsQuery['sort'],
): Prisma.TransactionOrderByWithRelationInput[] {
  const [field, direction] = sort.split(':') as ['occurredAt' | 'amount', 'asc' | 'desc'];
  // transaction_id is the tie-breaker so pagination is stable (design-doc D10).
  return field === 'amount'
    ? [{ amount: direction }, { occurredAt: 'desc' }, { id: 'desc' }]
    : [{ occurredAt: direction }, { id: direction }];
}

/** Stored row → the same shape a client would send, so PATCH can merge and re-validate. */
function toInputShape(row: TransactionDetailRow): Record<string, unknown> {
  return {
    type: row.type,
    walletId: row.walletId.toString(),
    toWalletId: row.toWalletId?.toString() ?? null,
    categoryId: row.categoryId?.toString() ?? null,
    amount: row.amount.toFixed(2),
    toAmount: row.toAmount?.toFixed(2) ?? null,
    note: row.note,
    occurredAt: row.occurredAt.toISOString(),
    tagIds: row.tags.map(({ tag }) => tag.id.toString()),
  };
}

export function createTransactionsService(deps: TransactionsServiceDeps) {
  const { transactions, wallets, categories, tags, users, transaction } = deps;

  /**
   * Enforces business rules 1–4 (spec 5.4) and returns the columns to write.
   * `mustBeActive` lists wallets that may not be archived: every wallet on create,
   * only the wallets that CHANGED on update (editing an old entry stays possible).
   */
  async function resolve(
    userId: bigint,
    input: ParsedTransactionInput,
    mustBeActive: (walletId: bigint) => boolean,
    db: Db,
  ): Promise<{ data: TransactionWriteData; tagIds: bigint[] }> {
    const walletId = BigInt(input.walletId);
    const toWalletId = input.type === 'transfer' ? BigInt(input.toWalletId) : null;

    // Rule 1: every referenced wallet must belong to the user → otherwise 404.
    const ids = toWalletId === null ? [walletId] : [walletId, toWalletId];
    const found = await wallets.findManyByIds(userId, ids, db);
    const source = found.find((wallet) => wallet.id === walletId);
    const target = toWalletId === null ? null : found.find((wallet) => wallet.id === toWalletId);
    if (!source || (toWalletId !== null && !target)) {
      throw errors.notFound('ไม่พบกระเป๋าเงิน');
    }

    // Rule 4: archived wallets cannot receive new entries.
    for (const wallet of [source, target]) {
      if (wallet && wallet.isArchived && mustBeActive(wallet.id)) {
        throw errors.conflict(`กระเป๋า "${wallet.name}" ถูก archive แล้ว บันทึกรายการไม่ได้`);
      }
    }

    let categoryId: bigint | null = null;
    let toAmount: Prisma.Decimal | null = null;

    if (input.type === 'transfer') {
      // Rule 3: cross-currency transfers need the received amount; same-currency must not have it.
      const crossCurrency = source.currencyCode !== target?.currencyCode;
      if (crossCurrency && !input.toAmount) {
        throw errors.validation(undefined, [
          { path: 'toAmount', message: 'โอนข้ามสกุลเงินต้องระบุจำนวนเงินที่เข้ากระเป๋าปลายทาง' },
        ]);
      }
      if (!crossCurrency && input.toAmount) {
        throw errors.validation(undefined, [
          { path: 'toAmount', message: 'โอนภายในสกุลเงินเดียวกันไม่ต้องระบุ toAmount' },
        ]);
      }
      toAmount = input.toAmount ? toDecimal(input.toAmount) : null;
    } else {
      // Rules 1 + 2: category must be visible (own or system) and of the same type.
      categoryId = BigInt(input.categoryId);
      const category = await categories.findVisibleById(userId, categoryId, db);
      if (!category) {
        throw errors.notFound('ไม่พบหมวดหมู่');
      }
      if (category.type !== input.type) {
        throw errors.validation(undefined, [
          { path: 'categoryId', message: 'ประเภทหมวดไม่ตรงกับประเภทรายการ' },
        ]);
      }
    }

    // Rule 1 for tags.
    const tagIds = (input.tagIds ?? []).map((id) => BigInt(id));
    if (tagIds.length > 0) {
      const ownedTags = await tags.findManyByIds(userId, tagIds, db);
      if (ownedTags.length !== tagIds.length) {
        throw errors.notFound('ไม่พบแท็ก');
      }
    }

    return {
      data: {
        type: input.type,
        walletId,
        toWalletId,
        categoryId,
        amount: toDecimal(input.amount),
        toAmount,
        note: input.note ?? null,
        occurredAt: new Date(input.occurredAt),
      },
      tagIds,
    };
  }

  async function getOrThrow(userId: bigint, id: bigint, db?: Db): Promise<TransactionDetailDto> {
    const row = await transactions.findActiveById(userId, id, db);
    if (!row) {
      throw errors.notFound(TRANSACTION_NOT_FOUND);
    }
    return toTransactionDetailDto(row);
  }

  return {
    async list(
      userId: bigint,
      query: ListTransactionsQuery,
    ): Promise<{ data: TransactionDto[]; meta: PaginationMeta }> {
      const user = await users.findById(userId);
      if (!user) {
        throw errors.unauthorized();
      }
      // Rule 9: "from/to" are calendar days in the USER's timezone, not UTC.
      const occurredAt = localDateRangeToUtc(query.from, query.to, user.timezone);
      const walletId = toBigIntId(query.walletId);
      const categoryId = toBigIntId(query.categoryId);
      const tagId = toBigIntId(query.tagId);

      const where: Prisma.TransactionWhereInput = {
        userId,
        deletedAt: query.deleted ? { not: null } : null,
        ...(query.type ? { type: query.type } : {}),
        ...(occurredAt.gte || occurredAt.lt ? { occurredAt } : {}),
        ...(walletId ? { OR: [{ walletId }, { toWalletId: walletId }] } : {}),
        // A parent category includes its children (design-doc X7).
        ...(categoryId ? { category: { OR: [{ id: categoryId }, { parentId: categoryId }] } } : {}),
        ...(tagId ? { tags: { some: { tagId } } } : {}),
        ...(query.q ? { note: { contains: escapeLikePattern(query.q), mode: 'insensitive' } } : {}),
      };

      const { rows, total } = await transactions.findPage(
        where,
        orderByFor(query.sort),
        (query.page - 1) * query.limit,
        query.limit,
      );
      return {
        data: rows.map(toTransactionDto),
        meta: { page: query.page, limit: query.limit, total },
      };
    },

    get: (userId: bigint, id: bigint) => getOrThrow(userId, id),

    async create(userId: bigint, input: ParsedTransactionInput): Promise<TransactionDetailDto> {
      // Rule 3 (engineering): transaction + tags are written atomically.
      return transaction(async (tx) => {
        const { data, tagIds } = await resolve(userId, input, () => true, tx);
        const id = await transactions.create(userId, data, tagIds, tx);
        return getOrThrow(userId, id, tx);
      });
    },

    async update(
      userId: bigint,
      id: bigint,
      patch: UpdateTransactionData,
    ): Promise<TransactionDetailDto> {
      return transaction(async (tx) => {
        const existing = await transactions.findActiveById(userId, id, tx);
        if (!existing) {
          throw errors.notFound(TRANSACTION_NOT_FOUND);
        }

        // Merge, then validate the RESULT with the same schema as create: a PATCH can
        // never produce a shape that POST would reject (e.g. a transfer without toWalletId).
        const definedPatch = Object.fromEntries(
          Object.entries(patch).filter(([, value]) => value !== undefined),
        );
        const parsed = transactionInputSchema.safeParse({
          ...toInputShape(existing),
          ...definedPatch,
        });
        if (!parsed.success) {
          throw errors.validation(undefined, zodIssuesToDetails(parsed.error.issues));
        }

        const previousWallets = new Set([existing.walletId, existing.toWalletId]);
        const { data, tagIds } = await resolve(
          userId,
          parsed.data,
          (walletId) => !previousWallets.has(walletId),
          tx,
        );
        await transactions.update(userId, id, data, patch.tagIds ? tagIds : undefined, tx);
        return getOrThrow(userId, id, tx);
      });
    },

    async delete(userId: bigint, id: bigint): Promise<void> {
      if (!(await transactions.softDelete(userId, id))) {
        throw errors.notFound(TRANSACTION_NOT_FOUND);
      }
    },

    async restore(userId: bigint, id: bigint): Promise<TransactionDetailDto> {
      return transaction(async (tx) => {
        const deleted = await transactions.findDeletedById(userId, id, tx);
        if (!deleted) {
          throw errors.notFound(TRANSACTION_NOT_FOUND);
        }
        const ids = [deleted.walletId, deleted.toWalletId].filter((value) => value !== null);
        const related = await wallets.findManyByIds(userId, ids, tx);
        const archived = related.find((wallet) => wallet.isArchived);
        if (archived) {
          throw errors.conflict(`กระเป๋า "${archived.name}" ถูก archive แล้ว กู้คืนรายการไม่ได้`);
        }
        await transactions.restore(userId, id, tx);
        return getOrThrow(userId, id, tx);
      });
    },
  };
}

export type TransactionsService = ReturnType<typeof createTransactionsService>;

export const transactionsService = createTransactionsService({
  transactions: transactionsRepository,
  wallets: walletsRepository,
  categories: categoriesRepository,
  tags: tagsRepository,
  users: usersRepository,
  transaction: runInTransaction,
});
