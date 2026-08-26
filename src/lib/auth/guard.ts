import {redirect} from 'next/navigation';

import {type SessionUser, getSessionUser} from '@/lib/auth/session';
import type {AppLocale} from '@/i18n/routing';

/**
 * Server-side access control for the console.
 *
 * The proxy in src/proxy.ts only checks that a session cookie exists, because
 * the Edge runtime cannot reach the database. This module performs the real
 * check - is the token valid, is the session still live, does the account
 * still exist - and is what every admin page and action actually relies on.
 */

/**
 * Requires a signed-in user, redirecting to the login page if there is none.
 *
 * @param locale Locale segment, so the redirect lands in the reader's language.
 * @param returnTo Path to come back to after signing in.
 * @returns The signed-in user.
 */
export async function requireUser(
  locale: AppLocale,
  returnTo?: string,
): Promise<SessionUser> {
  const user = await getSessionUser();

  if (!user) {
    const query = returnTo ? `?next=${encodeURIComponent(returnTo)}` : '';
    redirect(`/${locale}/admin/login${query}`);
  }

  return user;
}

/**
 * Requires an administrator.
 *
 * @param locale Locale segment used for the redirect.
 * @returns The signed-in administrator.
 */
export async function requireAdmin(locale: AppLocale): Promise<SessionUser> {
  const user = await requireUser(locale);

  if (user.role !== 'ADMIN') {
    redirect(`/${locale}/admin`);
  }

  return user;
}

/**
 * Requires a signed-in user inside a server action.
 *
 * Actions cannot redirect meaningfully before they have done any work, so this
 * throws instead; the caller turns the failure into a form error.
 *
 * @throws {Error} When there is no valid session.
 */
export async function requireUserForAction(): Promise<SessionUser> {
  const user = await getSessionUser();

  if (!user) {
    throw new Error('Not signed in.');
  }

  return user;
}
