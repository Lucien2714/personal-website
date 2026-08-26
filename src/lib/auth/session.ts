import {createHash, randomUUID} from 'node:crypto';

import {SignJWT, jwtVerify} from 'jose';
import {cookies} from 'next/headers';

import type {UserRole} from '@/generated/prisma/enums';
import {db} from '@/lib/db';
import {env, isProduction} from '@/lib/env';

/**
 * Admin session handling.
 *
 * A session is a short JWT stored in an HTTP-only cookie, paired with a row in
 * the `sessions` table. The JWT alone would be enough to authenticate, but it
 * cannot be withdrawn before it expires; the table adds that. Only a hash of
 * the token identifier is stored, so a database dump does not yield usable
 * credentials.
 */

/** Name of the cookie carrying the session token. */
export const SESSION_COOKIE_NAME = 'pw_session';

const JWT_ISSUER = 'personal-website';
const JWT_AUDIENCE = 'personal-website-admin';

const secretKey = new TextEncoder().encode(env.AUTH_SECRET);

/** The authenticated principal behind the current request. */
export interface SessionUser {
  id: string;
  email: string;
  displayName: string;
  role: UserRole;
  avatarUrl: string | null;
  /** Set when the owner has blocked this account from commenting. */
  blockedAt: Date | null;
}

/** Hashes a token identifier for storage. */
function hashTokenId(tokenId: string): string {
  return createHash('sha256').update(tokenId).digest('hex');
}

/** Metadata recorded alongside a session. */
export interface SessionContext {
  userAgent?: string | null;
  ipAddress?: string | null;
}

/**
 * Mints a session token and records it in the database.
 *
 * Separated from {@link createSession} because minting needs only a database
 * connection, while writing the cookie needs a request context. Keeping them
 * apart is what allows the session machinery to be exercised from a test or a
 * CLI script.
 *
 * @param userId Identifier of the user signing in.
 * @param context Request metadata shown in the session list, so that an
 *     unfamiliar device can be spotted and revoked.
 * @returns The signed token and the moment it stops being valid.
 */
export async function issueSessionToken(
  userId: string,
  context: SessionContext = {},
): Promise<{token: string; expiresAt: Date}> {
  const tokenId = randomUUID();
  const expiresAt = new Date(Date.now() + env.AUTH_SESSION_TTL_SECONDS * 1000);

  await db.session.create({
    data: {
      userId,
      tokenHash: hashTokenId(tokenId),
      userAgent: context.userAgent?.slice(0, 512) ?? null,
      ipAddress: context.ipAddress ?? null,
      expiresAt,
    },
  });

  const token = await new SignJWT({})
    .setProtectedHeader({alg: 'HS256', typ: 'JWT'})
    .setSubject(userId)
    .setJti(tokenId)
    .setIssuedAt()
    .setIssuer(JWT_ISSUER)
    .setAudience(JWT_AUDIENCE)
    .setExpirationTime(Math.floor(expiresAt.getTime() / 1000))
    .sign(secretKey);

  return {token, expiresAt};
}

/**
 * Issues a session for a user and writes the cookie.
 *
 * @param userId Identifier of the user signing in.
 * @param context Request metadata recorded for the session list.
 */
export async function createSession(
  userId: string,
  context: SessionContext = {},
): Promise<void> {
  const {token, expiresAt} = await issueSessionToken(userId, context);

  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE_NAME, token, {
    httpOnly: true,
    // `lax` still sends the cookie on top-level navigation, which is what the
    // admin area needs, while blocking it on cross-site sub-requests.
    sameSite: 'lax',
    secure: isProduction,
    path: '/',
    expires: expiresAt,
  });
}

/**
 * Reads and validates the session behind the current request.
 *
 * @returns The signed-in user, or null when there is no valid session. Both a
 *     missing cookie and a revoked, expired or forged token yield null.
 */
export async function getSessionUser(): Promise<SessionUser | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;
  if (!token) {
    return null;
  }

  let tokenId: string | undefined;
  try {
    const {payload} = await jwtVerify(token, secretKey, {
      issuer: JWT_ISSUER,
      audience: JWT_AUDIENCE,
    });
    tokenId = payload.jti;
  } catch {
    // Expired, tampered with, or signed by a previous AUTH_SECRET.
    return null;
  }

  if (!tokenId) {
    return null;
  }

  const session = await db.session.findUnique({
    where: {tokenHash: hashTokenId(tokenId)},
    select: {
      revokedAt: true,
      expiresAt: true,
      user: {
        select: {
          id: true,
          email: true,
          displayName: true,
          role: true,
          avatarUrl: true,
          blockedAt: true,
        },
      },
    },
  });

  if (!session || session.revokedAt || session.expiresAt <= new Date()) {
    return null;
  }

  return session.user;
}

/**
 * Revokes the current session and clears the cookie.
 *
 * Signing out is best-effort by design: the cookie is always removed, even if
 * the session row has already been deleted by the cleanup job.
 */
export async function destroySession(): Promise<void> {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;

  if (token) {
    try {
      const {payload} = await jwtVerify(token, secretKey, {
        issuer: JWT_ISSUER,
        audience: JWT_AUDIENCE,
      });
      if (payload.jti) {
        await db.session.updateMany({
          where: {tokenHash: hashTokenId(payload.jti), revokedAt: null},
          data: {revokedAt: new Date()},
        });
      }
    } catch {
      // An unverifiable token has no session row to revoke.
    }
  }

  cookieStore.delete(SESSION_COOKIE_NAME);
}

/**
 * Removes session rows that can no longer authenticate anyone.
 *
 * @returns How many rows were deleted.
 */
export async function pruneExpiredSessions(): Promise<number> {
  const {count} = await db.session.deleteMany({
    where: {expiresAt: {lt: new Date()}},
  });
  return count;
}
