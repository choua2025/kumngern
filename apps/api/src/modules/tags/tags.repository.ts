import type { Db } from '../../lib/db.js';
import { prisma } from '../../lib/prisma.js';

const tagSelect = { id: true, name: true } as const;

/** Every query is scoped by user_id (engineering rule 2). */
export const tagsRepository = {
  findAll(userId: bigint, db: Db = prisma) {
    return db.tag.findMany({ where: { userId }, select: tagSelect, orderBy: { name: 'asc' } });
  },

  findById(userId: bigint, tagId: bigint, db: Db = prisma) {
    return db.tag.findFirst({ where: { id: tagId, userId }, select: tagSelect });
  },

  findByName(userId: bigint, name: string, db: Db = prisma) {
    return db.tag.findFirst({ where: { userId, name }, select: tagSelect });
  },

  /** Ownership check for the tagIds of a transaction. */
  findManyByIds(userId: bigint, ids: bigint[], db: Db = prisma) {
    return db.tag.findMany({ where: { userId, id: { in: ids } }, select: { id: true } });
  },

  create(userId: bigint, name: string, db: Db = prisma) {
    return db.tag.create({ data: { userId, name }, select: tagSelect });
  },

  async rename(userId: bigint, tagId: bigint, name: string, db: Db = prisma): Promise<boolean> {
    const { count } = await db.tag.updateMany({ where: { id: tagId, userId }, data: { name } });
    return count > 0;
  },

  /** transaction_tags rows go with it (ON DELETE CASCADE); transactions themselves stay. */
  async delete(userId: bigint, tagId: bigint, db: Db = prisma): Promise<boolean> {
    const { count } = await db.tag.deleteMany({ where: { id: tagId, userId } });
    return count > 0;
  },
};

export type TagsRepository = typeof tagsRepository;
