import type { Db } from '../../lib/db.js';
import { prisma } from '../../lib/prisma.js';

export const currenciesRepository = {
  findAll(db: Db = prisma) {
    return db.currency.findMany({ orderBy: { code: 'asc' } });
  },

  async exists(code: string, db: Db = prisma): Promise<boolean> {
    const count = await db.currency.count({ where: { code } });
    return count > 0;
  },
};

export type CurrenciesRepository = typeof currenciesRepository;
