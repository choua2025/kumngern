import {
  type CreateRecurringData,
  type RecurringDto,
  type RecurringFrequency,
  recurringRuleIssues,
  type UpdateRecurringData,
} from '@income-expenses/shared';
import { errors } from '../../lib/errors.js';
import { toDecimal, toMoneyString } from '../../lib/money.js';
import { dateOnly, todayIn, toDateColumn } from '../../lib/recurrence.js';
import {
  type CategoriesRepository,
  categoriesRepository,
} from '../categories/categories.repository.js';
import { type UsersRepository, usersRepository } from '../users/users.repository.js';
import { type WalletsRepository, walletsRepository } from '../wallets/wallets.repository.js';
import {
  type RecurringRepository,
  type RecurringRow,
  type RecurringWriteData,
  recurringRepository,
} from './recurring.repository.js';

const RECURRING_NOT_FOUND = 'ไม่พบรายการประจำ';

export function toRecurringDto(row: RecurringRow): RecurringDto {
  return {
    id: row.id.toString(),
    type: row.type as RecurringDto['type'],
    wallet: {
      id: row.wallet.id.toString(),
      name: row.wallet.name,
      currencyCode: row.wallet.currencyCode,
    },
    category: {
      id: row.category.id.toString(),
      name: row.category.name,
      icon: row.category.icon,
      color: row.category.color,
      parentId: row.category.parentId?.toString() ?? null,
    },
    amount: toMoneyString(row.amount),
    note: row.note,
    frequency: row.frequency as RecurringFrequency,
    nextRunDate: dateOnly(row.nextRunDate),
    endDate: row.endDate ? dateOnly(row.endDate) : null,
    isActive: row.isActive,
  };
}

/** The full record as the client sees it — create input and PATCH-merged result share it. */
interface RecurringState {
  type: 'income' | 'expense';
  walletId: string;
  categoryId: string;
  amount: string;
  note: string | null;
  frequency: RecurringFrequency;
  nextRunDate: string;
  endDate: string | null;
  isActive: boolean;
}

interface RecurringServiceDeps {
  recurring: RecurringRepository;
  wallets: WalletsRepository;
  categories: CategoriesRepository;
  users: UsersRepository;
  now?: () => Date;
}

export function createRecurringService(deps: RecurringServiceDeps) {
  const { recurring, wallets, categories, users } = deps;
  const now = deps.now ?? (() => new Date());

  async function getOrThrow(userId: bigint, recurringId: bigint): Promise<RecurringRow> {
    const row = await recurring.findById(userId, recurringId);
    if (!row) {
      throw errors.notFound(RECURRING_NOT_FOUND);
    }
    return row;
  }

  /**
   * Business rules shared by create and update. `changed` tells which references
   * must be re-validated: an old recurring may keep pointing at a wallet that was
   * archived later (the job deactivates it), but you cannot newly pick one.
   */
  async function validate(
    userId: bigint,
    state: RecurringState,
    changed: { wallet: boolean; nextRunDate: boolean },
  ): Promise<RecurringWriteData> {
    const issues = recurringRuleIssues(state);
    if (issues.length > 0) {
      throw errors.validation(undefined, issues);
    }

    const walletId = BigInt(state.walletId);
    const [wallet] = await wallets.findManyByIds(userId, [walletId]);
    if (!wallet) {
      throw errors.notFound('ไม่พบกระเป๋าเงิน');
    }
    if (wallet.isArchived && (changed.wallet || state.isActive)) {
      throw errors.conflict(`กระเป๋า "${wallet.name}" ถูก archive แล้ว ตั้งรายการประจำไม่ได้`);
    }

    const categoryId = BigInt(state.categoryId);
    const category = await categories.findVisibleById(userId, categoryId);
    if (!category) {
      throw errors.notFound('ไม่พบหมวดหมู่');
    }
    if (category.type !== state.type) {
      throw errors.validation(undefined, [
        { path: 'categoryId', message: 'ประเภทหมวดไม่ตรงกับประเภทรายการ' },
      ]);
    }

    if (changed.nextRunDate) {
      const user = await users.findById(userId);
      if (!user) {
        throw errors.unauthorized();
      }
      // "Today" in the user's timezone: a past start would make the job back-fill entries.
      if (state.nextRunDate < todayIn(user.timezone, now())) {
        throw errors.validation(undefined, [
          { path: 'nextRunDate', message: 'วันที่เริ่มต้องไม่ก่อนวันนี้' },
        ]);
      }
    }

    return {
      type: state.type,
      walletId,
      categoryId,
      amount: toDecimal(state.amount),
      note: state.note,
      frequency: state.frequency,
      nextRunDate: toDateColumn(state.nextRunDate),
      endDate: state.endDate ? toDateColumn(state.endDate) : null,
      isActive: state.isActive,
    };
  }

  return {
    async list(userId: bigint): Promise<RecurringDto[]> {
      return (await recurring.findAll(userId)).map(toRecurringDto);
    },

    async create(userId: bigint, input: CreateRecurringData): Promise<RecurringDto> {
      const data = await validate(
        userId,
        { ...input, note: input.note ?? null, endDate: input.endDate ?? null, isActive: true },
        { wallet: true, nextRunDate: true },
      );
      const id = await recurring.create(userId, data);
      return toRecurringDto(await getOrThrow(userId, id));
    },

    async update(
      userId: bigint,
      recurringId: bigint,
      input: UpdateRecurringData,
    ): Promise<RecurringDto> {
      const current = toRecurringDto(await getOrThrow(userId, recurringId));
      const merged: RecurringState = {
        type: input.type ?? current.type,
        walletId: input.walletId ?? current.wallet.id,
        categoryId: input.categoryId ?? current.category.id,
        amount: input.amount ?? current.amount,
        note: input.note === undefined ? current.note : input.note,
        frequency: input.frequency ?? current.frequency,
        nextRunDate: input.nextRunDate ?? current.nextRunDate,
        endDate: input.endDate === undefined ? current.endDate : input.endDate,
        isActive: input.isActive ?? current.isActive,
      };
      const reactivated = merged.isActive && !current.isActive;
      const data = await validate(userId, merged, {
        wallet: merged.walletId !== current.wallet.id,
        // Re-activating a paused recurring whose date already passed would back-fill
        // every missed run — require a date from today on instead.
        nextRunDate: merged.nextRunDate !== current.nextRunDate || reactivated,
      });
      if (!(await recurring.update(userId, recurringId, data))) {
        throw errors.notFound(RECURRING_NOT_FOUND);
      }
      return toRecurringDto(await getOrThrow(userId, recurringId));
    },

    async delete(userId: bigint, recurringId: bigint): Promise<void> {
      if (!(await recurring.delete(userId, recurringId))) {
        throw errors.notFound(RECURRING_NOT_FOUND);
      }
    },
  };
}

export type RecurringService = ReturnType<typeof createRecurringService>;
export const recurringService = createRecurringService({
  recurring: recurringRepository,
  wallets: walletsRepository,
  categories: categoriesRepository,
  users: usersRepository,
});
