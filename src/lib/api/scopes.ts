/**
 * API permission scopes.
 *
 * Deliberately a module of its own, with no imports. The console renders the
 * scope list in a client component, and if this list lived beside the key
 * verification logic that component would pull the database client - and
 * therefore `net`, `tls` and `fs` - into the browser bundle.
 */

/** Permissions an API key can be granted. */
export const API_SCOPES = [
  'posts:read',
  'posts:write',
  'moments:read',
  'moments:write',
  'projects:read',
  'projects:write',
  'media:write',
] as const;

/** A single permission string. */
export type ApiScope = (typeof API_SCOPES)[number];

/** Narrows arbitrary JSON to the known scope strings. */
export function toScopes(value: unknown): ApiScope[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return value.filter((item): item is ApiScope =>
    (API_SCOPES as readonly string[]).includes(item as string),
  );
}
