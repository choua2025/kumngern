import { prisma } from '../../lib/prisma.js';

export const healthRepository = {
  /** Round-trip to PostgreSQL. Throws if the database is unreachable. */
  async ping(): Promise<void> {
    await prisma.$queryRaw`SELECT 1`;
  },
};
