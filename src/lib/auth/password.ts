import {
  type BinaryLike,
  type ScryptOptions,
  randomBytes,
  scrypt as scryptCallback,
  timingSafeEqual,
} from 'node:crypto';
import {promisify} from 'node:util';

/**
 * Password hashing built on Node's built-in scrypt.
 *
 * scrypt is memory-hard, which is the property that matters against GPU
 * cracking, and it ships with Node itself. Using it avoids a native bcrypt or
 * argon2 dependency that would need a compiler on every machine that builds
 * this project, including the Docker image.
 */

/**
 * Promisified `crypto.scrypt`.
 *
 * `promisify` picks the three-argument overload, which drops the options
 * parameter that carries the cost settings. The explicit signature restores
 * it; it is a type-level correction, not a behavioural one.
 */
const scrypt = promisify(scryptCallback) as (
  password: BinaryLike,
  salt: BinaryLike,
  keylen: number,
  options: ScryptOptions,
) => Promise<Buffer>;

/**
 * scrypt cost parameters.
 *
 * `N = 2^16` with `r = 8` costs roughly 64 MiB of memory and ~100 ms per hash
 * on a modern CPU: slow enough to make offline cracking expensive, fast enough
 * that a sign-in still feels instant. Raising `N` later is safe because the
 * parameters are stored inside each hash.
 */
const SCRYPT_PARAMS = {
  cost: 2 ** 16,
  blockSize: 8,
  parallelization: 1,
  keyLength: 64,
  saltBytes: 16,
  /** Node refuses to run scrypt unless it may allocate at least 128*N*r bytes. */
  maxmem: 128 * 2 ** 16 * 8 * 2,
} as const;

/** Identifies the hash format, so a future algorithm change stays detectable. */
const HASH_PREFIX = 'scrypt';

/** Minimum length accepted for a new password. */
export const MIN_PASSWORD_LENGTH = 12;

/**
 * Hashes a plain-text password.
 *
 * @param password The password as typed by the user.
 * @returns A self-describing hash of the form
 *     `scrypt$N$r$p$<salt-base64>$<hash-base64>`, safe to store as-is.
 */
export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(SCRYPT_PARAMS.saltBytes);
  const derived = await scrypt(
    password.normalize('NFKC'),
    salt,
    SCRYPT_PARAMS.keyLength,
    {
      N: SCRYPT_PARAMS.cost,
      r: SCRYPT_PARAMS.blockSize,
      p: SCRYPT_PARAMS.parallelization,
      maxmem: SCRYPT_PARAMS.maxmem,
    },
  );

  return [
    HASH_PREFIX,
    SCRYPT_PARAMS.cost,
    SCRYPT_PARAMS.blockSize,
    SCRYPT_PARAMS.parallelization,
    salt.toString('base64'),
    derived.toString('base64'),
  ].join('$');
}

/**
 * Checks a password against a stored hash.
 *
 * The comparison is constant time, and a malformed stored hash is reported as
 * a mismatch rather than an exception so that a corrupted row cannot be used
 * to distinguish accounts.
 *
 * @param password The password as typed by the user.
 * @param storedHash A value previously returned by {@link hashPassword}.
 */
export async function verifyPassword(
  password: string,
  storedHash: string,
): Promise<boolean> {
  const parts = storedHash.split('$');
  if (parts.length !== 6 || parts[0] !== HASH_PREFIX) {
    return false;
  }

  const [, costText, blockSizeText, parallelText, saltB64, expectedB64] = parts;
  const cost = Number(costText);
  const blockSize = Number(blockSizeText);
  const parallelization = Number(parallelText);

  if (
    !Number.isInteger(cost) ||
    !Number.isInteger(blockSize) ||
    !Number.isInteger(parallelization)
  ) {
    return false;
  }

  const salt = Buffer.from(saltB64 ?? '', 'base64');
  const expected = Buffer.from(expectedB64 ?? '', 'base64');
  if (salt.length === 0 || expected.length === 0) {
    return false;
  }

  let derived: Buffer;
  try {
    derived = await scrypt(password.normalize('NFKC'), salt, expected.length, {
      N: cost,
      r: blockSize,
      p: parallelization,
      maxmem: 128 * cost * blockSize * 2,
    });
  } catch {
    // Unsupported parameters in the stored hash: treat as a failed match.
    return false;
  }

  return timingSafeEqual(derived, expected);
}
