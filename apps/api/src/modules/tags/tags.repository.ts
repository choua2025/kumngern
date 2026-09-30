import type { Db } from '../../lib/db.js';
import { prisma } from '../../lib/prisma.js';

/** Phase 5 only needs ownership checks for tagIds; tag CRUD arrives in Phase 13. */
export const tagsRepository = {
  findManyByIds(userId: bigint, ids: bigint[], db: Db = prisma) {
    return db.tag.findMany({ where: { userId, id: { in: ids } }, select: { id: true } });
  },
};

export type TagsRepository = typeof tagsRepository;
