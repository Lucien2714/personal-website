import type {NextRequest} from 'next/server';
import {NextResponse} from 'next/server';

import {callbackUrl} from '@/app/api/auth/[provider]/route';
import {clientIdentifier} from '@/lib/api/rate-limit';
import {linkOAuthAccount} from '@/lib/auth/oauth/link';
import {
  exchangeCodeForToken,
  findConfiguredProvider,
} from '@/lib/auth/oauth/providers';
import {
  OAUTH_STATE_COOKIE,
  decodeState,
  nonceMatches,
  stateCookieOptions,
} from '@/lib/auth/oauth/state';
import {issueSessionToken} from '@/lib/auth/session';
import {SESSION_COOKIE_NAME} from '@/lib/auth/session';
import {env, isProduction} from '@/lib/env';

/**
 * `/api/auth/{provider}/callback` - completes a reader sign-in.
 *
 * The order of checks matters. State is verified *before* the code is
 * exchanged, so a forged callback costs the attacker a rejected request rather
 * than a round trip to the provider on our credentials.
 */

/** Sends the reader back with a message the sign-in page can render. */
function failTo(returnTo: string, reason: string): NextResponse {
  const target = new URL(returnTo, env.NEXT_PUBLIC_SITE_URL);
  target.searchParams.set('signin_error', reason);

  const response = NextResponse.redirect(target.toString());
  response.cookies.delete(OAUTH_STATE_COOKIE);
  return response;
}

/** Handles the provider's redirect back to the site. */
export async function GET(
  request: NextRequest,
  context: {params: Promise<{provider: string}>},
): Promise<NextResponse> {
  const {provider: slug} = await context.params;
  const state = decodeState(request.cookies.get(OAUTH_STATE_COOKIE)?.value);
  const returnTo = state?.returnTo ?? '/';

  const provider = findConfiguredProvider(slug);
  if (!provider) {
    return failTo(returnTo, 'unknown_provider');
  }

  // The provider reports a refusal by redirecting here with `error` set.
  if (request.nextUrl.searchParams.get('error')) {
    return failTo(returnTo, 'cancelled');
  }

  const receivedState = request.nextUrl.searchParams.get('state');
  if (
    !state ||
    state.provider !== slug ||
    !receivedState ||
    !nonceMatches(state.nonce, receivedState)
  ) {
    // Either the cookie expired, or this callback was not started by this
    // browser. Both are indistinguishable from here, and both must fail.
    return failTo(returnTo, 'invalid_state');
  }

  const code = request.nextUrl.searchParams.get('code');
  if (!code) {
    return failTo(returnTo, 'missing_code');
  }

  let userId: string;
  try {
    const accessToken = await exchangeCodeForToken(
      provider,
      code,
      callbackUrl(provider.slug),
    );
    const profile = await provider.fetchProfile(accessToken);
    userId = await linkOAuthAccount(provider.id, profile);
  } catch (error) {
    // The detail is for the operator; the reader gets a code they can act on.
    console.error(`[auth] ${slug} sign-in failed`, error);
    return failTo(returnTo, 'provider_error');
  }

  const {token, expiresAt} = await issueSessionToken(userId, {
    userAgent: request.headers.get('user-agent'),
    ipAddress: clientIdentifier(request),
  });

  const response = NextResponse.redirect(
    new URL(returnTo, env.NEXT_PUBLIC_SITE_URL).toString(),
  );

  response.cookies.set(SESSION_COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: isProduction,
    path: '/',
    expires: expiresAt,
  });
  response.cookies.set(OAUTH_STATE_COOKIE, '', {
    ...stateCookieOptions,
    maxAge: 0,
  });

  return response;
}
