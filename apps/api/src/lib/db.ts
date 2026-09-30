import type { Prisma } from '../generated/prisma/client.js';
import { prisma } from './prisma.js';

/**
 * Anything that can run queries: the global client or the `tx` handed out by
 * `prisma.$transaction`. Repositories accept it as their last argument so the same
 * function works inside and outside a transaction.
 */
export type Db = Prisma.TransactionClient;

export type TransactionRunner = <T>(work: (tx: Db) => Promise<T>) => Promise<T>;

/** Real implementation; unit tests inject a fake that just calls `work(fakeTx)`. */
export const runInTransaction: TransactionRunner = (work) => prisma.$transaction(work);
