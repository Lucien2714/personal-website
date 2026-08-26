import createIntlMiddleware from 'next-intl/middleware';
import type {NextRequest} from 'next/server';
import {NextResponse} from 'next/server';

import {routing} from '@/i18n/routing';

/**
 * Edge proxy (the file convention formerly called `middleware`, renamed in
 * Next.js 16).
 *
 * Two jobs, in order:
 *
 *   1. Keep the public API and static assets out of the locale router. A
 *      request to `/api/v1/posts` must not be rewritten to `/en/api/v1/posts`.
 *   2. Negotiate the locale for page requests and redirect a bare `/` to the
 *      visitor's preferred language.
 *
 * Authentication is deliberately *not* enforced here. Verifying a session
 * means reading the database, which the Edge runtime cannot do; the admin
 * layout performs the real check on the server instead. Middleware only
 * short-circuits the obvious case of no cookie at all, which saves a render
 * without ever being the sole line of defence.
 */

const intlMiddleware = createIntlMiddleware(routing);

/** Cookie name duplicated from src/lib/auth/session.ts. */
const SESSION_COOKIE_NAME = 'pw_session';

/** Paths that bypass locale routing entirely. */
const BYPASS_PREFIXES = ['/api', '/_next', '/uploads', '/feed', '/sitemap'];

/** Entry point invoked by Next.js for every matched request. */
export default function proxy(request: NextRequest): NextResponse {
  const {pathname} = request.nextUrl;

  if (BYPASS_PREFIXES.some((prefix) => pathname.startsWith(prefix))) {
    return NextResponse.next();
  }

  // `/en/admin/...` and `/zh/admin/...` both require a session cookie.
  const isAdminPath = /^\/(?:en|zh)\/admin(?:\/|$)/.test(pathname);
  const isLoginPath = /^\/(?:en|zh)\/admin\/login$/.test(pathname);

  if (isAdminPath && !isLoginPath) {
    const hasSessionCookie = request.cookies.has(SESSION_COOKIE_NAME);
    if (!hasSessionCookie) {
      const locale = pathname.split('/')[1] ?? routing.defaultLocale;
      const loginUrl = new URL(`/${locale}/admin/login`, request.url);
      // Remember where the visitor was heading so that signing in returns
      // them there instead of dumping them on the dashboard.
      loginUrl.searchParams.set('next', pathname);
      return NextResponse.redirect(loginUrl);
    }
  }

  return intlMiddleware(request);
}

export const config = {
  /**
   * Match every path except Next.js internals and files with an extension.
   * The negative lookahead keeps the middleware off image and font requests,
   * which would otherwise pay the locale-negotiation cost for nothing.
   */
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\..*).*)'],
};
