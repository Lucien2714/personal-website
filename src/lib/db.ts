import {PrismaPg} from '@prisma/adapter-pg';

import {PrismaClient} from '@/generated/prisma/client';
import {env, isProduction} from '@/lib/env';

/**
 * The application's single Prisma client.
 *
 * Next.js reloads modules on every edit in development, so a naive
 * `new PrismaClient()` at module scope would open a fresh connection pool on
 * each save and eventually exhaust Postgres' connection limit. Caching the
 * instance on `globalThis` survives those reloads; in production the module is
 * evaluated once and the cache is never read.
 */

/** Builds a client wired to Postgres through the official driver adapter. */
function createPrismaClient(): PrismaClient {
  const adapter = new PrismaPg({connectionString: env.DATABASE_URL});

  return new PrismaClient({
    adapter,
    // Query logging is opt-in rather than on by default in development: it is
    // genuinely useful when tracking down an N+1, and pure noise the rest of
    // the time, especially in the CLI scripts.
    log:
      process.env.PRISMA_LOG_QUERIES === '1'
        ? ['query', 'error', 'warn']
        : ['error', 'warn'],
  });
}

const globalForPrisma = globalThis as unknown as {
  prismaClient?: PrismaClient;
};

/** Shared database handle. Import this rather than constructing a client. */
export const db: PrismaClient =
  globalForPrisma.prismaClient ?? createPrismaClient();

if (!isProduction) {
  globalForPrisma.prismaClient = db;
}
