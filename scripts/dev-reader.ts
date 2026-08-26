/**
 * Creates a throwaway reader account and prints a session cookie for it.
 *
 *   npx tsx scripts/dev-reader.ts
 *
 * Exists so the reader-versus-staff boundary can be exercised without standing
 * up a real OAuth provider: the thing worth testing is what a READER session
 * can and cannot reach, not the redirect dance that produced it.
 *
 * Refuses to run in production, where it would be a way to mint a session for
 * an account nobody created.
 */

// Populates process.env from .env before any module reads it.
import 'dotenv/config';

import {
  SESSION_COOKIE_NAME,
  issueSessionToken,
} from '../src/lib/auth/session.js';
import {db} from '../src/lib/db.js';

/** Email used for the throwaway account, so repeated runs reuse one row. */
const READER_EMAIL = 'dev-reader@users.noreply.invalid';

/** Entry point. */
async function main(): Promise<void> {
  if (process.env.NODE_ENV === 'production') {
    throw new Error('Refusing to mint a reader session in production.');
  }

  const reader = await db.user.upsert({
    where: {email: READER_EMAIL},
    create: {
      email: READER_EMAIL,
      displayName: 'Dev Reader',
      role: 'READER',
    },
    update: {role: 'READER', blockedAt: null},
    select: {id: true},
  });

  const {token} = await issueSessionToken(reader.id, {
    userAgent: 'dev-reader-script',
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
