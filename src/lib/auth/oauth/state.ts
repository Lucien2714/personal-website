import {randomBytes, timingSafeEqual} from 'node:crypto';

import {isProduction} from '@/lib/env';

/**
 * The `state` parameter that protects the OAuth redirect.
 *
 * Without it, an attacker can complete the provider's dance in their own
 * browser and then feed the resulting `code` to the victim's browser, logging
 * the victim into the attacker's account - which is a real attack, not a
 * theoretical one, because anything the victim then writes lands in the
 * attacker's account.
 *
 * The defence: mint a random value, put it in a short-lived cookie *and* in
 * the redirect URL, and refuse any callback where the two disagree. The cookie
 * also carries where to return to, so the reader lands back on the page they
 * were reading rather than the home page.
 */

/** Cookie holding the pending state. Cleared as soon as it is used. */
export const OAUTH_STATE_COOKIE = 'pw_oauth_state';

/**
 * How long a sign-in attempt may take.
 *
 * Ten minutes is long enough to create a provider account mid-flow and short
 * enough that an abandoned attempt cannot be resumed much later.
 */
export const OAUTH_STATE_TTL_SECONDS = 600;

/** What the state cookie carries. */
export interface OAuthState {
  /** Random value echoed through the provider. */
  nonce: string;
  /** Provider slug, so a callback cannot be replayed against another one. */
  provider: string;
  /** Same-site path to return to after signing in. */
  returnTo: string;
}

/** Creates a fresh, unguessable nonce. */
export function createNonce(): string {
  return randomBytes(32).toString('base64url');
}

/** Serialises the state for storage in a cookie. */
export function encodeState(state: OAuthState): string {
  return Buffer.from(JSON.stringify(state), 'utf8').toString('base64url');
}

/**
 * Parses a state cookie.
 *
 * @returns The state, or null when the cookie is absent or malformed. A
 *     malformed cookie is treated as no cookie: the sign-in simply fails.
 */
export function decodeState(raw: string | undefined): OAuthState | null {
  if (!raw) {
    return null;
  }

  try {
    const parsed: unknown = JSON.parse(
      Buffer.from(raw, 'base64url').toString('utf8'),
    );

    if (
      typeof parsed === 'object' &&
      parsed !== null &&
      typeof (parsed as OAuthState).nonce === 'string' &&
      typeof (parsed as OAuthState).provider === 'string' &&
      typeof (parsed as OAuthState).returnTo === 'string'
    ) {
      return parsed as OAuthState;
    }
  } catch {
    // Fall through: an unreadable cookie is no cookie.
  }

  return null;
}

/**
 * Compares two nonces in constant time.
 *
 * Length is compared first because `timingSafeEqual` throws on a mismatch;
 * that leak is harmless, since the length is fixed by our own generator.
 */
export function nonceMatches(expected: string, received: string): boolean {
  const a = Buffer.from(expected);
  const b = Buffer.from(received);
  return a.length === b.length && timingSafeEqual(a, b);
}

/**
 * Restricts a return path to somewhere on this site.
 *
 * A crafted `next` must not be able to turn the sign-in link into an open
 * redirect, so anything that is not a plain absolute path is discarded.
 * `//evil.com` is rejected specifically: browsers read it as protocol-relative
 * and would leave the site.
 */
export function safeReturnPath(
  candidate: string | null,
  fallback: string,
): string {
  if (!candidate || !candidate.startsWith('/') || candidate.startsWith('//')) {
    return fallback;
  }
  return candidate;
}

/** Cookie options shared by the routes that set and clear the state. */
export const stateCookieOptions = {
  httpOnly: true,
  sameSite: 'lax' as const,
  secure: isProduction,
  path: '/',
};
