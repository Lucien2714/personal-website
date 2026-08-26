/**
 * Sets an account's password from the command line.
 *
 *   npx tsx scripts/set-password.ts --email you@example.com --password '...'
 *
 * This is the recovery path for a forgotten console password. Unlike the other
 * scripts in this directory it *is* allowed to run in production, because that
 * is precisely where it is needed — locking yourself out of the console with
 * no way back would be a worse outcome than the risk this carries.
 *
 * The password is read from `--password`, or from the `NEW_PASSWORD`
 * environment variable when that flag is absent. Prefer the environment
 * variable: an argument is visible to anyone who can run `ps` and is recorded
 * in your shell history.
 */

// Populates process.env from .env before any module reads it.
import 'dotenv/config';

import {MIN_PASSWORD_LENGTH, hashPassword} from '../src/lib/auth/password.js';
import {db} from '../src/lib/db.js';

/** Reads a `--flag value` pair out of the argument list. */
function readFlag(argv: string[], flag: string): string | undefined {
  const index = argv.indexOf(flag);
  return index >= 0 ? argv[index + 1] : undefined;
}

/** Entry point. */
async function main(): Promise<void> {
  const argv = process.argv.slice(2);

  const email = readFlag(argv, '--email')?.trim().toLowerCase();
  const password = readFlag(argv, '--password') ?? process.env.NEW_PASSWORD;

  if (!email) {
    throw new Error('Pass --email <address>.');
  }
  if (!password) {
    throw new Error('Pass --password <value>, or set NEW_PASSWORD.');
  }
  if (password.length < MIN_PASSWORD_LENGTH) {
    throw new Error(
      `The password must be at least ${MIN_PASSWORD_LENGTH} characters.`,
    );
  }

  const user = await db.user.findUnique({
    where: {email},
    select: {id: true},
  });

  if (!user) {
    throw new Error(`No account found for ${email}.`);
  }

  await db.user.update({
    where: {id: user.id},
    data: {passwordHash: await hashPassword(password)},
  });

  // Every existing session was created under the old password; a password
  // reset that leaves them alive is not really a reset.
  const {count} = await db.session.updateMany({
    where: {userId: user.id, revokedAt: null},
    data: {revokedAt: new Date()},
  });

  console.log(`Password updated for ${email}.`);
  console.log(`Revoked ${count} active session(s).`);
}

main()
  .catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(() => {
    void db.$disconnect();
  });
