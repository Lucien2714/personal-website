/**
 * Mints an API key from the command line and prints it.
 *
 * Useful when wiring up another project against a local instance, and for
 * smoke-testing the write endpoints without clicking through the console:
 *
 *   npx tsx scripts/dev-api-key.ts --name my-bot --scopes posts:write,media:write
 *
 * Like the key screen in the console, the key is printed once and cannot be
 * recovered afterwards. It refuses to run in production, where keys should be
 * created through the console so that they are visible and revocable there.
 */

// Populates process.env from .env before any module reads it.
import 'dotenv/config';

import {API_SCOPES, type ApiScope, createApiKey} from '../src/lib/api/keys.js';
import {db} from '../src/lib/db.js';

/** Reads a `--flag value` pair out of the argument list. */
function readFlag(argv: string[], flag: string): string | undefined {
  const index = argv.indexOf(flag);
  return index >= 0 ? argv[index + 1] : undefined;
}

/** Entry point. */
async function main(): Promise<void> {
  if (process.env.NODE_ENV === 'production') {
    throw new Error('Create production keys in the console, not from a shell.');
  }

  const argv = process.argv.slice(2);
  const name = readFlag(argv, '--name') ?? 'cli-key';
  const requested = (readFlag(argv, '--scopes') ?? 'posts:read')
    .split(',')
    .map((scope) => scope.trim())
    .filter((scope) => scope.length > 0);

  const unknown = requested.filter(
    (scope) => !(API_SCOPES as readonly string[]).includes(scope),
  );
  if (unknown.length > 0) {
    throw new Error(
      `Unknown scope(s): ${unknown.join(', ')}. Valid scopes: ${API_SCOPES.join(', ')}`,
    );
  }

  const admin = await db.user.findFirst({
    where: {role: 'ADMIN'},
    orderBy: {createdAt: 'asc'},
    select: {id: true},
  });

  if (!admin) {
    throw new Error('No admin user found. Run `npm run db:seed` first.');
  }

  const created = await createApiKey(
    admin.id,
    name,
    requested as ApiScope[],
    null,
  );

  process.stdout.write(created.key);
}

main()
  .catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => {
    void db.$disconnect();
  });
