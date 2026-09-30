import type { Db } from '../../lib/db.js';
import { prisma } from '../../lib/prisma.js';

interface CreateUserData {
  email: string;
  passwordHash: string;
  displayName: string;
  defaultCurrency: string;
}

interface UpdateUserData {
  displayName?: string | undefined;
  defaultCurrency?: string | undefined;
  timezone?: string | undefined;
}

export const usersRepository = {
  findById(id: bigint, db: Db = prisma) {
    return db.user.findUnique({ where: { id } });
  },

  /** `email` must already be lower-cased (the Zod schema does it). */
  findByEmail(email: string, db: Db = prisma) {
    return db.user.findUnique({ where: { email } });
  },

  create(data: CreateUserData, db: Db = prisma) {
    return db.user.create({ data });
  },

  update(id: bigint, data: UpdateUserData, db: Db = prisma) {
    return db.user.update({ where: { id }, data });
  },

  async updatePasswordHash(id: bigint, passwordHash: string, db: Db = prisma): Promise<void> {
    await db.user.update({ where: { id }, data: { passwordHash } });
  },
};

export type UsersRepository = typeof usersRepository;
