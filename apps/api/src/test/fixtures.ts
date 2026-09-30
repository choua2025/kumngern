import type {
  CreateWalletInput,
  TransactionDetailDto,
  TransactionInput,
  WalletDto,
} from '@income-expenses/shared';
import type { Express } from 'express';
import request from 'supertest';
import { prisma } from '../lib/prisma.js';

const API = '/api/v1';

/** Supertest bound to one user's access token: `client.get('/wallets')`. */
export function apiClient(app: Express, accessToken: string) {
  const auth = { Authorization: `Bearer ${accessToken}` };
  return {
    get: (path: string) => request(app).get(`${API}${path}`).set(auth),
    post: (path: string, body?: object) => request(app).post(`${API}${path}`).set(auth).send(body),
    patch: (path: string, body: object) => request(app).patch(`${API}${path}`).set(auth).send(body),
    delete: (path: string) => request(app).delete(`${API}${path}`).set(auth),
  };
}

export type ApiClient = ReturnType<typeof apiClient>;

let walletCounter = 0;

export async function createWallet(
  client: ApiClient,
  overrides: Partial<CreateWalletInput> = {},
): Promise<WalletDto> {
  walletCounter += 1;
  const res = await client.post('/wallets', {
    name: `Wallet ${walletCounter}`,
    type: 'cash',
    currencyCode: 'THB',
    initialBalance: '0',
    ...overrides,
  });
  if (res.status !== 201) {
    throw new Error(`createWallet failed: ${res.status} ${JSON.stringify(res.body)}`);
  }
  return (res.body as { data: WalletDto }).data;
}

export async function createTransaction(
  client: ApiClient,
  input: TransactionInput,
): Promise<TransactionDetailDto> {
  const res = await client.post('/transactions', input);
  if (res.status !== 201) {
    throw new Error(`createTransaction failed: ${res.status} ${JSON.stringify(res.body)}`);
  }
  return (res.body as { data: TransactionDetailDto }).data;
}

export async function getBalance(client: ApiClient, walletId: string): Promise<string> {
  const res = await client.get(`/wallets/${walletId}`);
  return (res.body as { data: WalletDto }).data.balance;
}

/** Id of a seeded system category (reference data), e.g. systemCategoryId('อาหาร', 'expense'). */
export async function systemCategoryId(name: string, type: 'income' | 'expense'): Promise<string> {
  const category = await prisma.category.findFirstOrThrow({
    where: { userId: null, name, type },
    select: { id: true },
  });
  return category.id.toString();
}
