import { PrismaPg } from '@prisma/adapter-pg';
import { config } from '../config/index.js';
import { PrismaClient } from '../generated/prisma/client.js';

/**
 * One PrismaClient (= one connection pool) per process.
 * Creating a client per request would open a new pool each time and exhaust
 * PostgreSQL's max_connections under load.
 */
export const prisma = new PrismaClient({
  adapter: new PrismaPg({
    connectionString: config.DATABASE_URL,
    max: 10,
    // Fail fast when the database is unreachable instead of hanging /ready.
    connectionTimeoutMillis: 5_000,
    idleTimeoutMillis: 30_000,
  }),
});
