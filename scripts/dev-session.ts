/**
 * Prints a valid session cookie for the first admin account.
 *
 * Intended for local smoke-testing of the console with curl or an HTTP client,
 * so that verifying a protected page does not require driving a browser:
 *
 *   npx tsx scripts/dev-session.ts
 *   curl -H "Cookie: $(npx tsx scripts/dev-session.ts)" http://127.0.0.1:4173/en/admin
 *
 * It refuses to run against a production environment: handing out a session
 * from a shell is a development convenience, not a supported operation.
 */

// Populates process.env from .env before any module reads it.
import 'dotenv/config';

import {
  SESSION_COOKIE_NAME,
  issueSessionToken,
} from '../src/lib/auth/session.js';
import {db} from '../src/lib/db.js';

/** Entry point. */
async function main(): Promise<void> {
  if (process.env.NODE_ENV === 'production') {
    throw new Error('Refusing to mint a session in production.');
  }

  const admin = await db.user.findFirst({
    where: {role: 'ADMIN'},
    orderBy: {createdAt: 'asc'},
    select: {id: true, email: true},
  });

  if (!admin) {
    throw new Error('No admin user found. Run `npm run db:seed` first.');
  }

  const {token} = await issueSessionToken(admin.id, {
    userAgent: 'dev-session-script',
  });

  process.stdout.write(`${SESSION_COOKIE_NAME}=${token}`);
}

main()
  .catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => {
    void db.$disconnect();
  });
