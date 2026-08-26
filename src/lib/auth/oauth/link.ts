import type {AuthProvider} from '@/generated/prisma/enums';
import type {OAuthProfile} from '@/lib/auth/oauth/providers';
import {db} from '@/lib/db';

/**
 * Turns a provider profile into a local account.
 *
 * Three cases, in the order they are checked:
 *
 *   1. This provider identity is already linked - sign that user in, and
 *      refresh the details the provider owns (avatar, display name), which
 *      change upstream and should not go stale here.
 *   2. The verified email matches an existing account - link the identity to
 *      it, so signing in with GitHub and later with Gitee gives one person one
 *      account rather than two. This is also how the owner's credential
 *      account gains an OAuth login.
 *   3. Neither - create a reader.
 *
 * Case 2 is only safe because both providers only ever hand us a *verified*
 * address. If a provider is added that does not, it must not participate in
 * email matching, or an attacker could claim someone else's account by
 * registering their address elsewhere.
 */

/** Providers whose email addresses are verified and safe to match on. */
const PROVIDERS_WITH_VERIFIED_EMAIL: readonly AuthProvider[] = [
  'GITHUB',
  'GITEE',
];

/**
 * Builds a stable placeholder address for a reader whose provider withheld
 * theirs.
 *
 * `email` is unique and non-null in the schema because the owner's credential
 * login needs it. Rather than weaken that for every row, readers without an
 * address get one that is unique, obviously synthetic, and not deliverable -
 * so no mail is ever sent to it by accident.
 */
function syntheticEmail(
  provider: AuthProvider,
  providerAccountId: string,
): string {
  return `${provider.toLowerCase()}-${providerAccountId}@users.noreply.invalid`;
}

/**
 * Finds or creates the user behind an OAuth profile.
 *
 * @param provider Which provider authenticated the person.
 * @param profile What that provider reported about them.
 * @returns The user's id.
 */
export async function linkOAuthAccount(
  provider: AuthProvider,
  profile: OAuthProfile,
): Promise<string> {
  const existingLink = await db.account.findUnique({
    where: {
      provider_providerAccountId: {
        provider,
        providerAccountId: profile.providerAccountId,
      },
    },
    select: {userId: true},
  });

  if (existingLink) {
    await db.user.update({
      where: {id: existingLink.userId},
      data: {
        // The provider owns these; let them change upstream.
        displayName: profile.displayName,
        avatarUrl: profile.avatarUrl,
        lastLoginAt: new Date(),
      },
    });

    await db.account.update({
      where: {
        provider_providerAccountId: {
          provider,
          providerAccountId: profile.providerAccountId,
        },
      },
      data: {providerUsername: profile.username},
    });

    return existingLink.userId;
  }

  const matchableEmail =
    profile.email && PROVIDERS_WITH_VERIFIED_EMAIL.includes(provider)
      ? profile.email.toLowerCase()
      : null;

  if (matchableEmail) {
    const byEmail = await db.user.findUnique({
      where: {email: matchableEmail},
      select: {id: true},
    });

    if (byEmail) {
      await db.account.create({
        data: {
          userId: byEmail.id,
          provider,
          providerAccountId: profile.providerAccountId,
          providerUsername: profile.username,
        },
      });

      await db.user.update({
        where: {id: byEmail.id},
        data: {lastLoginAt: new Date()},
      });

      return byEmail.id;
    }
  }

  const created = await db.user.create({
    data: {
      email:
        matchableEmail ?? syntheticEmail(provider, profile.providerAccountId),
      displayName: profile.displayName,
      avatarUrl: profile.avatarUrl,
      websiteUrl: profile.websiteUrl,
      // New accounts are readers. Promoting one to staff is a deliberate act
      // performed in the database or the console, never a side effect of
      // signing in.
      role: 'READER',
      lastLoginAt: new Date(),
      accounts: {
        create: {
          provider,
          providerAccountId: profile.providerAccountId,
          providerUsername: profile.username,
        },
      },
    },
    select: {id: true},
  });

  return created.id;
}
