import type {
  CreateWalletData,
  UpdateWalletInput,
  WalletDto,
  WalletType,
} from '@income-expenses/shared';
import { errors } from '../../lib/errors.js';
import { toDecimal, toMoneyString } from '../../lib/money.js';
import { type CurrenciesService, currenciesService } from '../currencies/currencies.service.js';
import {
  type WalletsRepository,
  type WalletWithBalance,
  walletsRepository,
} from './wallets.repository.js';

const WALLET_NOT_FOUND = 'errors.walletNotFound';
const DUPLICATE_NAME = 'errors.walletDuplicate';

export function toWalletDto(wallet: WalletWithBalance): WalletDto {
  return {
    id: wallet.id.toString(),
    name: wallet.name,
    type: wallet.type as WalletType,
    currencyCode: wallet.currencyCode,
    initialBalance: toMoneyString(wallet.initialBalance),
    balance: toMoneyString(wallet.balance),
    isArchived: wallet.isArchived,
    createdAt: wallet.createdAt.toISOString(),
  };
}

interface WalletsServiceDeps {
  wallets: WalletsRepository;
  currencies: CurrenciesService;
}

export function createWalletsService({ wallets, currencies }: WalletsServiceDeps) {
  async function getOrThrow(userId: bigint, walletId: bigint): Promise<WalletDto> {
    const wallet = await wallets.findOneWithBalance(userId, walletId);
    if (!wallet) {
      throw errors.notFound(WALLET_NOT_FOUND);
    }
    return toWalletDto(wallet);
  }

  return {
    async list(userId: bigint, includeArchived: boolean): Promise<WalletDto[]> {
      const rows = await wallets.findManyWithBalance(userId, { includeArchived });
      return rows.map(toWalletDto);
    },

    get: getOrThrow,

    async create(userId: bigint, input: CreateWalletData): Promise<WalletDto> {
      await currencies.assertExists(input.currencyCode, 'currencyCode');
      if (await wallets.findByName(userId, input.name)) {
        throw errors.conflict(DUPLICATE_NAME);
      }
      // A concurrent request with the same name still hits uq_wallets_user_name → 409.
      const walletId = await wallets.create({
        userId,
        name: input.name,
        type: input.type,
        currencyCode: input.currencyCode,
        initialBalance: toDecimal(input.initialBalance),
      });
      return getOrThrow(userId, walletId);
    },

    async update(userId: bigint, walletId: bigint, input: UpdateWalletInput): Promise<WalletDto> {
      if (input.name !== undefined) {
        const sameName = await wallets.findByName(userId, input.name);
        if (sameName && sameName.id !== walletId) {
          throw errors.conflict(DUPLICATE_NAME);
        }
      }
      if (!(await wallets.update(userId, walletId, input))) {
        throw errors.notFound(WALLET_NOT_FOUND);
      }
      return getOrThrow(userId, walletId);
    },

    /** Business rule 5: a wallet with history cannot be deleted — archive it instead. */
    async delete(userId: bigint, walletId: bigint): Promise<void> {
      // Ownership first, so another user's wallet is a 404 — never a revealing 409.
      await getOrThrow(userId, walletId);
      if (await wallets.isInUse(walletId)) {
        throw errors.conflict('errors.walletInUse');
      }
      if (!(await wallets.delete(userId, walletId))) {
        throw errors.notFound(WALLET_NOT_FOUND);
      }
    },
  };
}

export type WalletsService = ReturnType<typeof createWalletsService>;

export const walletsService = createWalletsService({
  wallets: walletsRepository,
  currencies: currenciesService,
});
