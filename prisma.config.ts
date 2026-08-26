import 'dotenv/config';
import path from 'node:path';
import {defineConfig} from 'prisma/config';

/**
 * Prisma CLI configuration.
 *
 * Since Prisma 7 the connection string is no longer part of schema.prisma.
 * The CLI (migrate, studio, db push) reads it from here, while the runtime
 * client gets its connection through a driver adapter in src/lib/db.ts.
 */
export default defineConfig({
  schema: path.join('prisma', 'schema.prisma'),
  migrations: {
    path: path.join('prisma', 'migrations'),
    seed: 'tsx prisma/seed.ts',
  },
  datasource: {
    url: process.env.DATABASE_URL ?? '',
  },
});
