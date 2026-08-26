import {redirect} from 'next/navigation';

import type {UserRole} from '@/generated/prisma/enums';
import type {AppLocale} from '@/i18n/routing';
import {type SessionUser, getSessionUser} from '@/lib/auth/session';

/**
 * Server-side access control.
 *
 * Two populations share one session mechanism: staff, who run the site, and
 * readers, who signed in to comment. Everything here exists to keep the second
 * group out of the first group's pages.
 *
 * The proxy in src/proxy.ts checks only that a session *cookie* exists,
 * because the Edge runtime cannot reach the database. It is an optimisation,
 * never a gate. This module performs the real check - is the token valid, is
 * the session live, does the account still exist, and does it hold a role that
 * may do this - and every console page and server action calls it.
 *
 * Server actions call these individually rather than relying on the console
 * layout. A server action is a public HTTP endpoint in its own right: anyone
 * who learns its identifier can invoke it directly, and the layout's check
 * never runs.
 */

/** Roles permitted to open the console. */
const STAFF_ROLES: readonly UserRole[] = ['ADMIN', 'EDITOR'];

/** True when the role may reach the console at all. */
export function isStaffRole(role: UserRole): boolean {
  return STAFF_ROLES.includes(role);
}

/**
 * Requires a staff account, redirecting to the console sign-in otherwise.
 *
 * A signed-in reader is treated exactly like a signed-out visitor: they are
 * sent to the console login rather than shown a "forbidden" page, because
 * confirming that a page exists is itself information.
 *
 * @param locale Locale segment, so the redirect lands in the reader's language.
 * @param returnTo Path to come back to after signing in.
 */
export async function requireStaff(
  locale: AppLocale,
  returnTo?: string,
): Promise<SessionUser> {
  const user = await getSessionUser();

  if (!user || !isStaffRole(user.role)) {
    const query = returnTo ? `?next=${encodeURIComponent(returnTo)}` : '';
    redirect(`/${locale}/admin/login${query}`);
  }

  return user;
}

/**
 * Requires an administrator.
 *
 * @param locale Locale segment used for the redirect.
 */
export async function requireAdmin(locale: AppLocale): Promise<SessionUser> {
  const user = await requireStaff(locale);

  if (user.role !== 'ADMIN') {
    redirect(`/${locale}/admin`);
  }

  return user;
}

/**
 * Requires a staff account inside a server action.
 *
 * Actions cannot redirect meaningfully before they have done any work, so this
 * throws instead; the caller turns the failure into a form error.
 *
 * @throws {Error} When there is no valid session, or it belongs to a reader.
 */
export async function requireStaffForAction(): Promise<SessionUser> {
  const user = await getSessionUser();

  if (!user || !isStaffRole(user.role)) {
    throw new Error('Not authorised.');
  }

  return user;
}

/**
 * Requires any signed-in account inside a server action.
 *
 * Used by the comment actions, where staff and readers have the same rights.
 * A blocked account is rejected here rather than at sign-in, so that being
 * blocked is not immediately obvious.
 *
 * @throws {Error} When there is no valid session or the account is blocked.
 */
export async function requireReaderForAction(): Promise<SessionUser> {
  const user = await getSessionUser();

  if (!user) {
    throw new Error('Not signed in.');
  }

  if (user.blockedAt) {
    throw new Error('This account cannot post comments.');
  }

  return user;
}
