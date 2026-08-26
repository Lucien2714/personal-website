import type {AuthProvider} from '@/generated/prisma/enums';
import {env} from '@/lib/env';

/**
 * OAuth sign-in providers.
 *
 * Everything provider-specific lives behind one interface, so adding another
 * is a new object in `DEFINITIONS` plus two environment variables - not a
 * change to the routes, the session code, or the sign-in page.
 *
 * On the two that are *not* here: WeChat's website sign-in is only issued to
 * corporate entities, and QQ Connect requires an ICP-filed domain and has
 * effectively stopped accepting personal sites. Neither is obtainable for this
 * site today. If that changes, each needs roughly forty lines here and nothing
 * else.
 *
 * Access tokens are used once, inside the callback, and never stored: the site
 * never acts on a reader's behalf at the provider, so keeping one would be
 * holding a credential with no purpose and real downside.
 */

/** What a provider tells us about the person signing in. */
export interface OAuthProfile {
  /** The provider's immutable id for this person, not their username. */
  providerAccountId: string;
  /** Username at the provider, if it exposes one. */
  username: string | null;
  displayName: string;
  /** Null when the provider withholds it or the reader has none public. */
  email: string | null;
  avatarUrl: string | null;
  websiteUrl: string | null;
}

/** Everything the routes need to drive one provider. */
export interface OAuthProviderDefinition {
  /** Database enum value recorded on the linked account. */
  id: AuthProvider;
  /** URL segment, e.g. `github` in /api/auth/github. */
  slug: string;
  /** Name shown on the sign-in button. */
  label: string;
  authorizeUrl: string;
  tokenUrl: string;
  scope: string;
  /** Reads the signed-in person's profile using a fresh access token. */
  fetchProfile: (accessToken: string) => Promise<OAuthProfile>;
  /** Credentials, absent when the provider is not configured. */
  clientId: string | undefined;
  clientSecret: string | undefined;
}

/** Coerces an unknown JSON field to a trimmed string, or null. */
function asString(value: unknown): string | null {
  return typeof value === 'string' && value.trim().length > 0
    ? value.trim()
    : null;
}

/**
 * Performs a JSON request and fails loudly on a non-2xx response.
 *
 * Provider errors arrive as ordinary 200s with an `error` field about as often
 * as they arrive as error statuses, so callers check the body too.
 */
async function fetchJson(
  url: string,
  init: RequestInit,
): Promise<Record<string, unknown>> {
  const response = await fetch(url, {
    ...init,
    headers: {Accept: 'application/json', ...init.headers},
    // Provider responses are per-request and must never be cached.
    cache: 'no-store',
  });

  if (!response.ok) {
    throw new Error(
      `OAuth request to ${url} failed with status ${response.status}.`,
    );
  }

  return (await response.json()) as Record<string, unknown>;
}

/** Reads a GitHub profile, falling back to the email endpoint when needed. */
async function fetchGithubProfile(accessToken: string): Promise<OAuthProfile> {
  const headers = {
    Authorization: `Bearer ${accessToken}`,
    'X-GitHub-Api-Version': '2022-11-28',
    'User-Agent': 'personal-website',
  };

  const user = await fetchJson('https://api.github.com/user', {headers});

  let email = asString(user.email);
  if (!email) {
    // A reader with a private address gets no `email` on /user. The verified
    // primary from /user/emails is the correct one to link accounts by.
    try {
      const addresses = (await fetch('https://api.github.com/user/emails', {
        headers: {Accept: 'application/json', ...headers},
        cache: 'no-store',
      }).then((response) => (response.ok ? response.json() : []))) as Array<{
        email?: string;
        primary?: boolean;
        verified?: boolean;
      }>;

      email =
        asString(
          addresses.find((entry) => entry.primary && entry.verified)?.email,
        ) ?? null;
    } catch {
      // Not fatal: link.ts mints a synthetic address instead.
    }
  }

  return {
    providerAccountId: String(user.id),
    username: asString(user.login),
    displayName: asString(user.name) ?? asString(user.login) ?? 'GitHub user',
    email,
    avatarUrl: asString(user.avatar_url),
    websiteUrl: asString(user.blog),
  };
}

/** Reads a Gitee profile. */
async function fetchGiteeProfile(accessToken: string): Promise<OAuthProfile> {
  // Gitee's v5 API takes the token as a query parameter rather than a header.
  const user = await fetchJson(
    `https://gitee.com/api/v5/user?access_token=${encodeURIComponent(accessToken)}`,
    {},
  );

  return {
    providerAccountId: String(user.id),
    username: asString(user.login),
    displayName: asString(user.name) ?? asString(user.login) ?? 'Gitee user',
    email: asString(user.email),
    avatarUrl: asString(user.avatar_url),
    websiteUrl: asString(user.blog),
  };
}

/** Every provider this build knows how to talk to. */
const DEFINITIONS: OAuthProviderDefinition[] = [
  {
    id: 'GITHUB',
    slug: 'github',
    label: 'GitHub',
    authorizeUrl: 'https://github.com/login/oauth/authorize',
    tokenUrl: 'https://github.com/login/oauth/access_token',
    scope: 'read:user user:email',
    fetchProfile: fetchGithubProfile,
    clientId: env.OAUTH_GITHUB_CLIENT_ID,
    clientSecret: env.OAUTH_GITHUB_CLIENT_SECRET,
  },
  {
    id: 'GITEE',
    slug: 'gitee',
    label: 'Gitee',
    authorizeUrl: 'https://gitee.com/oauth/authorize',
    tokenUrl: 'https://gitee.com/oauth/token',
    scope: 'user_info',
    fetchProfile: fetchGiteeProfile,
    clientId: env.OAUTH_GITEE_CLIENT_ID,
    clientSecret: env.OAUTH_GITEE_CLIENT_SECRET,
  },
];

/** A provider that has both credentials set and can therefore be used. */
export interface ConfiguredProvider extends OAuthProviderDefinition {
  clientId: string;
  clientSecret: string;
}

/** True when both halves of a provider's credentials are present. */
function isConfigured(
  definition: OAuthProviderDefinition,
): definition is ConfiguredProvider {
  return Boolean(definition.clientId && definition.clientSecret);
}

/**
 * Providers this deployment can actually use.
 *
 * The sign-in page renders exactly this list, so an unconfigured provider is
 * never offered and can never produce a confusing failure halfway through the
 * redirect dance.
 */
export function configuredProviders(): ConfiguredProvider[] {
  return DEFINITIONS.filter(isConfigured);
}

/** Looks up a configured provider by URL slug. */
export function findConfiguredProvider(
  slug: string,
): ConfiguredProvider | null {
  return configuredProviders().find((entry) => entry.slug === slug) ?? null;
}

/** Exchanges an authorization code for an access token. */
export async function exchangeCodeForToken(
  provider: ConfiguredProvider,
  code: string,
  redirectUri: string,
): Promise<string> {
  const body = new URLSearchParams({
    client_id: provider.clientId,
    client_secret: provider.clientSecret,
    code,
    redirect_uri: redirectUri,
    grant_type: 'authorization_code',
  });

  const payload = await fetchJson(provider.tokenUrl, {
    method: 'POST',
    headers: {'Content-Type': 'application/x-www-form-urlencoded'},
    body: body.toString(),
  });

  const accessToken = asString(payload.access_token);
  if (!accessToken) {
    // Both providers report failures this way rather than with a status code.
    const detail =
      asString(payload.error_description) ?? asString(payload.error);
    throw new Error(
      `${provider.label} did not return an access token${detail ? `: ${detail}` : '.'}`,
    );
  }

  return accessToken;
}
