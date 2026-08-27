/**
 * Sets an account's password.
 *
 *   npx tsx scripts/set-password.ts --email you@example.com
 *
 * This is the recovery path for a forgotten console password. Unlike the other
 * scripts in this directory it *is* allowed to run in production, because that
 * is precisely where it is needed — locking yourself out of the console with
 * no way back would be a worse outcome than the risk this carries.
 *
 * With no password supplied it prompts for one, with the terminal echo off.
 * That is the recommended way to run it, and the reason the prompt exists:
 * every other route puts the password somewhere it outlives the command.
 *
 *   --password '...'   visible in `ps` and recorded in shell history
 *   NEW_PASSWORD=...   still recorded in shell history when written inline
 *
 * The environment variable is honoured for automation, where a password may
 * arrive from a secret store rather than a keyboard. If you use it from a
 * shell, export it separately and pass `-e NEW_PASSWORD` with no value so the
 * secret never becomes an argument:
 *
 *   read -rs NEW_PASSWORD && export NEW_PASSWORD
 *   docker compose run --rm -e NEW_PASSWORD migrate \
 *     npx tsx scripts/set-password.ts --email you@example.com
 *   unset NEW_PASSWORD
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

/**
 * Asks for a password without echoing it.
 *
 * Raw mode is used rather than `readline`, whose only way to suppress echo is
 * to overwrite a private method. Input arrives in chunks rather than one
 * keystroke at a time when the reader pastes, so each chunk is walked
 * character by character.
 */
function promptHidden(question: string): Promise<string> {
  const {stdin, stdout} = process;

  if (!stdin.isTTY) {
    return Promise.reject(
      new Error(
        'No terminal to prompt on. Pass --password, or set NEW_PASSWORD.',
      ),
    );
  }

  return new Promise((resolve, reject) => {
    let value = '';

    const finish = (settle: () => void) => {
      stdin.setRawMode(false);
      stdin.pause();
      stdin.removeListener('data', onData);
      stdout.write('\n');
      settle();
    };

    const onData = (chunk: string) => {
      for (const char of chunk) {
        switch (char) {
          case '\r':
          case '\n':
          case '\u0004': // Ctrl-D
            finish(() => resolve(value));
            return;
          case '\u0003': // Ctrl-C
            finish(() => reject(new Error('Cancelled.')));
            return;
          case '\u007f':
          case '\b':
            value = value.slice(0, -1);
            break;
          default:
            // Skip the remaining control characters; arrow keys and the like
            // would otherwise land in the password as escape sequences.
            if (char >= ' ') {
              value += char;
            }
        }
      }
    };

    stdout.write(question);
    stdin.setRawMode(true);
    stdin.resume();
    stdin.setEncoding('utf8');
    stdin.on('data', onData);
  });
}

/**
 * Obtains the new password, preferring the prompt.
 *
 * Confirmation is asked for only when prompting: a mistyped password that
 * nobody can see is otherwise a lockout discovered at the next sign-in.
 */
async function resolvePassword(argv: string[]): Promise<string> {
  const supplied = readFlag(argv, '--password') ?? process.env.NEW_PASSWORD;
  if (supplied) {
    return supplied;
  }

  const password = await promptHidden('New password: ');
  const again = await promptHidden('Confirm password: ');

  if (password !== again) {
    throw new Error('The two entries did not match.');
  }

  return password;
}

/** Entry point. */
async function main(): Promise<void> {
  const argv = process.argv.slice(2);

  const email = readFlag(argv, '--email')?.trim().toLowerCase();
  if (!email) {
    throw new Error('Pass --email <address>.');
  }

  // The account is looked up before the password is asked for, so that a typo
  // in the address is reported immediately rather than after typing a password
  // twice.
  const user = await db.user.findUnique({
    where: {email},
    select: {id: true},
  });

  if (!user) {
    throw new Error(`No account found for ${email}.`);
  }

  const password = await resolvePassword(argv);

  if (password.length < MIN_PASSWORD_LENGTH) {
    throw new Error(
      `The password must be at least ${MIN_PASSWORD_LENGTH} characters.`,
    );
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
