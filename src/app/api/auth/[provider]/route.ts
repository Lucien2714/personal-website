import type {NextRequest} from 'next/server';
import {NextResponse} from 'next/server';

import {findConfiguredProvider} from '@/lib/auth/oauth/providers';
import {
  OAUTH_STATE_COOKIE,
  OAUTH_STATE_TTL_SECONDS,
  createNonce,
  encodeState,
  safeReturnPath,
  stateCookieOptions,
} from '@/lib/auth/oauth/state';
import {env} from '@/lib/env';

/**
 * `/api/auth/{provider}` - starts a reader sign-in.
 *
 * Mints a state nonce, remembers it in a short-lived cookie along with where
 * to return to, and sends the reader to the provider.
 */

/** Builds the callback URL the provider must be configured with. */
export function callbackUrl(slug: string): string {
  return `${env.NEXT_PUBLIC_SITE_URL}/api/auth/${slug}/callback`;
}

/** Redirects to the provider's authorisation screen. */
export async function GET(
  request: NextRequest,
  context: {params: Promise<{provider: string}>},
): Promise<NextResponse> {
  const {provider: slug} = await context.params;
  const provider = findConfiguredProvider(slug);

  if (!provider) {
    // Covers both an unknown slug and one whose credentials are unset. Saying
    // only "not found" avoids advertising which providers exist but are
    // half-configured.
    return NextResponse.json(
      {error: {code: 'not_found', message: 'Unknown sign-in provider.'}},
      {status: 404},
    );
  }

  const nonce = createNonce();
  const returnTo = safeReturnPath(
    request.nextUrl.searchParams.get('next'),
    '/',
  );

  const authorize = new URL(provider.authorizeUrl);
  authorize.searchParams.set('client_id', provider.clientId);
  authorize.searchParams.set('redirect_uri', callbackUrl(provider.slug));
  authorize.searchParams.set('scope', provider.scope);
  authorize.searchParams.set('state', nonce);
  authorize.searchParams.set('response_type', 'code');

  const response = NextResponse.redirect(authorize.toString());
  response.cookies.set(
    OAUTH_STATE_COOKIE,
    encodeState({nonce, provider: provider.slug, returnTo}),
    {...stateCookieOptions, maxAge: OAUTH_STATE_TTL_SECONDS},
  );

  return response;
}
