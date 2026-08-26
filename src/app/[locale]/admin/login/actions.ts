'use server';

import {headers} from 'next/headers';
import {redirect} from 'next/navigation';

import {isAppLocale} from '@/i18n/routing';
import {checkRateLimit, clientIdentifier} from '@/lib/api/rate-limit';
import {verifyPassword} from '@/lib/auth/password';
import {createSession, destroySession} from '@/lib/auth/session';
import {db} from '@/lib/db';

/**
 * Sign-in and sign-out actions for the console.
 */

/** Result handed back to the login form. */
export interface SignInState {
  /** Translation key under the `auth` namespace, or null on success. */
  errorKey: 'invalidCredentials' | 'rateLimited' | null;
}

/** Attempts per minute allowed from one address before sign-in is refused. */
const SIGN_IN_ATTEMPTS_PER_MINUTE = 10;

/**
 * Reads a text field out of a form.
 *
 * `FormData.get` returns `string | File | null`, and coercing a `File` with
 * `String()` yields "[object File]" - a value that would silently become a
 * username or a redirect target. Anything that is not a string is treated as
 * absent instead.
 */
function readTextField(formData: FormData, name: string): string {
  const value = formData.get(name);
  return typeof value === 'string' ? value : '';
}

/**
 * Signs a user in.
 *
 * Deliberate properties:
 *
 *   * A wrong email and a wrong password produce the same message, so the form
 *     cannot be used to discover which accounts exist.
 *   * A password check runs even when the account does not exist, so response
 *     time does not reveal it either.
 *   * Attempts are rate limited per client address, which turns an online
 *     guessing attack into an impractically slow one.
 *
 * @param _previousState Ignored; present for the `useActionState` signature.
 * @param formData The submitted form.
 */
export async function signInAction(
  _previousState: SignInState,
  formData: FormData,
): Promise<SignInState> {
  const email = readTextField(formData, 'email').trim().toLowerCase();
  const password = readTextField(formData, 'password');
  const requestedLocale = readTextField(formData, 'locale');
  const locale = isAppLocale(requestedLocale) ? requestedLocale : 'en';
  const next = readTextField(formData, 'next');

  const headerList = await headers();
  const identifier = clientIdentifier(
    new Request('http://localhost', {headers: headerList}),
  );

  const limit = checkRateLimit(
    `signin:${identifier}`,
    SIGN_IN_ATTEMPTS_PER_MINUTE,
  );
  if (!limit.allowed) {
    return {errorKey: 'rateLimited'};
  }

  const user = await db.user.findUnique({
    where: {email},
    select: {id: true, passwordHash: true},
  });

  // A dummy hash keeps the work - and therefore the timing - the same whether
  // or not the account exists.
  const hashToCheck =
    user?.passwordHash ??
    'scrypt$65536$8$1$AAAAAAAAAAAAAAAAAAAAAA==$AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA';

  const passwordMatches = await verifyPassword(password, hashToCheck);

  if (!user || !passwordMatches) {
    return {errorKey: 'invalidCredentials'};
  }

  await createSession(user.id, {
    userAgent: headerList.get('user-agent'),
    ipAddress: identifier === 'unknown' ? null : identifier,
  });

  await db.user.update({
    where: {id: user.id},
    data: {lastLoginAt: new Date()},
  });

  // Only same-site paths are honoured, so a crafted `next` cannot bounce the
  // user to another origin after a successful sign-in.
  const destination =
    next.startsWith('/') && !next.startsWith('//') ? next : `/${locale}/admin`;

  redirect(destination);
}

/**
 * Signs the current user out and returns them to the login page.
 *
 * @param formData Carries the locale so the redirect stays in-language.
 */
export async function signOutAction(formData: FormData): Promise<void> {
  const requestedLocale = readTextField(formData, 'locale');
  const locale = isAppLocale(requestedLocale) ? requestedLocale : 'en';

  await destroySession();
  redirect(`/${locale}/admin/login`);
}
