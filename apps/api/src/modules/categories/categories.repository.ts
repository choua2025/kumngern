import type { Db } from '../../lib/db.js';
import { prisma } from '../../lib/prisma.js';

const categorySelect = {
  id: true,
  userId: true,
  parentId: true,
  name: true,
  type: true,
  icon: true,
  systemKey: true,
  color: true,
} as const;

/** Categories the user may USE: their own + system ones (user_id IS NULL). */
function visibleTo(userId: bigint) {
  return { OR: [{ userId }, { userId: null }] };
}

export const categoriesRepository = {
  findVisible(userId: bigint, type: string | undefined, db: Db = prisma) {
    return db.category.findMany({
      where: { ...visibleTo(userId), ...(type ? { type } : {}) },
      select: categorySelect,
      // System categories first, then the user's own, each in creation order.
      orderBy: [{ userId: { sort: 'asc', nulls: 'first' } }, { id: 'asc' }],
    });
  },

  findVisibleById(userId: bigint, categoryId: bigint, db: Db = prisma) {
    return db.category.findFirst({
      where: { id: categoryId, ...visibleTo(userId) },
      select: categorySelect,
    });
  },

  async create(
    data: {
      userId: bigint;
      parentId: bigint | null;
      name: string;
      type: string;
      icon: string | null;
      color: string | null;
    },
    db: Db = prisma,
  ): Promise<bigint> {
    const category = await db.category.create({ data, select: { id: true } });
    return category.id;
  },

  /** Only the user's OWN categories can be changed: the WHERE excludes system rows. */
  async update(
    userId: bigint,
    categoryId: bigint,
    data: {
      name?: string | undefined;
      parentId?: bigint | null | undefined;
      icon?: string | null | undefined;
      color?: string | null | undefined;
    },
    db: Db = prisma,
  ): Promise<boolean> {
    const { count } = await db.category.updateMany({ where: { id: categoryId, userId }, data });
    return count > 0;
  },

  async delete(userId: bigint, categoryId: bigint, db: Db = prisma): Promise<boolean> {
    const { count } = await db.category.deleteMany({ where: { id: categoryId, userId } });
    return count > 0;
  },

  async hasChildren(categoryId: bigint, db: Db = prisma): Promise<boolean> {
    return (await db.category.count({ where: { parentId: categoryId } })) > 0;
  },

  /** Soft-deleted transactions count as usage — their FK still points here. */
  async isInUse(categoryId: bigint, db: Db = prisma): Promise<boolean> {
    const counts = await Promise.all([
      db.transaction.count({ where: { categoryId } }),
      db.budget.count({ where: { categoryId } }),
      db.recurringTransaction.count({ where: { categoryId } }),
      db.category.count({ where: { parentId: categoryId } }),
    ]);
    return counts.some((count) => count > 0);
  },
};

export type CategoriesRepository = typeof categoriesRepository;
export type CategoryRow = NonNullable<Awaited<ReturnType<CategoriesRepository['findVisibleById']>>>;
