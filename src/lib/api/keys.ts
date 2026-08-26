import {createHash, randomBytes, timingSafeEqual} from 'node:crypto';

import {type ApiScope, toScopes} from '@/lib/api/scopes';
import {db} from '@/lib/db';

// Re-exported so that server-side callers can keep importing everything
// key-related from one place.
export {API_SCOPES, type ApiScope, toScopes} from '@/lib/api/scopes';

/**
 * API keys for the write side of the public API.
 *
 * A key is shown to its owner exactly once, at creation. Only a SHA-256 digest
 * is stored, so the key cannot be recovered from a database dump - the same
 * reasoning as for passwords, minus the need for a slow KDF: a 256-bit random
 * key has no guessable structure for an attacker to exploit, so there is
 * nothing for key-stretching to defend against.
 */

/** Prefix that makes a leaked key recognisable in logs and secret scanners. */
const KEY_PREFIX = 'pws_';

/** Bytes of entropy per key. */
const KEY_BYTES = 32;

/** A key that passed verification. */
export interface VerifiedKey {
  id: string;
  ownerId: string;
  name: string;
  scopes: ApiScope[];
}

/** Hashes a key for storage and lookup. */
function hashKey(key: string): string {
  return createHash('sha256').update(key).digest('hex');
}

/**
 * Creates a key for an owner.
 *
 * @param ownerId The user the key acts on behalf of.
 * @param name Human label shown in the console.
 * @param scopes Permissions to grant.
 * @param expiresAt Optional expiry.
 * @returns The record plus the clear-text key, which the caller must show to
 *     the user immediately and then discard.
 */
export async function createApiKey(
  ownerId: string,
  name: string,
  scopes: ApiScope[],
  expiresAt?: Date | null,
): Promise<{id: string; key: string; prefix: string}> {
  const secret = randomBytes(KEY_BYTES).toString('base64url');
  const key = `${KEY_PREFIX}${secret}`;
  const prefix = key.slice(0, KEY_PREFIX.length + 6);

  const record = await db.apiKey.create({
    data: {
      ownerId,
      name,
      prefix,
      keyHash: hashKey(key),
      scopes,
      expiresAt: expiresAt ?? null,
    },
    select: {id: true},
  });

  return {id: record.id, key, prefix};
}

/**
 * Verifies a bearer token against the stored keys.
 *
 * @param presented The raw `Authorization: Bearer <key>` value.
 * @returns The key's identity and scopes, or null if it is unknown, revoked or
 *     expired.
 */
export async function verifyApiKey(
  presented: string,
): Promise<VerifiedKey | null> {
  if (!presented.startsWith(KEY_PREFIX)) {
    return null;
  }

  const digest = hashKey(presented);
  const record = await db.apiKey.findUnique({
    where: {keyHash: digest},
    select: {
      id: true,
      ownerId: true,
      name: true,
      scopes: true,
      keyHash: true,
      revokedAt: true,
      expiresAt: true,
    },
  });

  if (!record || record.revokedAt) {
    return null;
  }

  if (record.expiresAt && record.expiresAt <= new Date()) {
    return null;
  }

  // The unique-index lookup already established equality; this comparison is
  // constant time purely so that no timing signal exists on the hash itself.
  const matches = timingSafeEqual(
    Buffer.from(record.keyHash, 'hex'),
    Buffer.from(digest, 'hex'),
  );
  if (!matches) {
    return null;
  }

  // Best-effort usage tracking; a failure here must not reject a valid key.
  void db.apiKey
    .update({where: {id: record.id}, data: {lastUsedAt: new Date()}})
    .catch(() => undefined);

  return {
    id: record.id,
    ownerId: record.ownerId,
    name: record.name,
    scopes: toScopes(record.scopes),
  };
}

/**
 * Extracts a bearer token from a request.
 *
 * @param request The incoming request.
 * @returns The token, or null when the header is missing or malformed.
 */
export function readBearerToken(request: Request): string | null {
  const header = request.headers.get('authorization');
  if (!header) {
    return null;
  }

  const [scheme, token] = header.split(' ');
  if (scheme?.toLowerCase() !== 'bearer' || !token) {
    return null;
  }

  return token.trim();
}
