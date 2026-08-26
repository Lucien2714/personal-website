import {describe, expect, it} from 'vitest';

import {
  MIN_PASSWORD_LENGTH,
  hashPassword,
  verifyPassword,
} from '@/lib/auth/password';

describe('password hashing', () => {
  it('accepts the password it hashed', async () => {
    const hash = await hashPassword('correct horse battery staple');
    await expect(
      verifyPassword('correct horse battery staple', hash),
    ).resolves.toBe(true);
  });

  it('rejects a wrong password', async () => {
    const hash = await hashPassword('correct horse battery staple');
    await expect(
      verifyPassword('Correct horse battery staple', hash),
    ).resolves.toBe(false);
  });

  it('salts every hash, so two identical passwords differ', async () => {
    const [first, second] = await Promise.all([
      hashPassword('same password'),
      hashPassword('same password'),
    ]);

    expect(first).not.toBe(second);
    await expect(verifyPassword('same password', second)).resolves.toBe(true);
  });

  it('encodes its parameters, so the cost can be raised later', async () => {
    const hash = await hashPassword('whatever');
    const [algorithm, cost, blockSize, parallelism] = hash.split('$');

    expect(algorithm).toBe('scrypt');
    expect(Number(cost)).toBeGreaterThanOrEqual(2 ** 14);
    expect(Number(blockSize)).toBe(8);
    expect(Number(parallelism)).toBe(1);
  });

  it('normalises Unicode, so the same typed password always matches', async () => {
    // U+00E9 and "e" + U+0301 render identically but are different code
    // points, and different keyboards produce different ones. NFKC folds
    // them together so the reader never has to care which they typed.
    const composed = 'café-password-123';
    const decomposed = 'café-password-123';
    expect(composed).not.toBe(decomposed);

    const hash = await hashPassword(composed);
    await expect(verifyPassword(decomposed, hash)).resolves.toBe(true);
  });

  it('treats a malformed stored hash as a mismatch rather than throwing', async () => {
    for (const malformed of [
      '',
      'not-a-hash',
      'scrypt$1$2$3',
      'bcrypt$65536$8$1$c2FsdA==$aGFzaA==',
      'scrypt$abc$8$1$c2FsdA==$aGFzaA==',
      'scrypt$65536$8$1$$',
    ]) {
      await expect(verifyPassword('anything', malformed)).resolves.toBe(false);
    }
  });

  it('publishes a minimum length for the seed script to enforce', () => {
    expect(MIN_PASSWORD_LENGTH).toBeGreaterThanOrEqual(8);
  });
});
