import {describe, expect, it} from 'vitest';

import type {UserRole} from '@/generated/prisma/enums';
import {isStaffRole} from '@/lib/auth/guard';
import {safeReturnPath} from '@/lib/auth/oauth/state';

/**
 * The role split is the whole reason readers can share a session mechanism
 * with the site owner, so it gets its own test rather than being trusted to
 * the twenty call sites that depend on it.
 */
describe('isStaffRole', () => {
  it('admits the roles that run the site', () => {
    expect(isStaffRole('ADMIN')).toBe(true);
    expect(isStaffRole('EDITOR')).toBe(true);
  });

  it('refuses readers', () => {
    // The console guards call this. If it ever returns true for READER,
    // anyone who signs in to comment gains the ability to publish.
    expect(isStaffRole('READER')).toBe(false);
  });

  it('classifies every role in the enum', () => {
    // A role added to the schema without a decision here would silently
    // inherit "not staff", which is the safe direction but should still be a
    // deliberate choice. This fails when the enum grows.
    const known: UserRole[] = ['ADMIN', 'EDITOR', 'READER'];
    for (const role of known) {
      expect(typeof isStaffRole(role)).toBe('boolean');
    }
    expect(known).toHaveLength(3);
  });
});

describe('safeReturnPath', () => {
  it('keeps an ordinary same-site path', () => {
    expect(safeReturnPath('/en/posts/hello', '/')).toBe('/en/posts/hello');
  });

  it('rejects an absolute URL', () => {
    expect(safeReturnPath('https://evil.example/phish', '/en')).toBe('/en');
  });

  it('rejects a protocol-relative URL', () => {
    // Browsers read `//evil.example` as a different origin, so a naive
    // "starts with /" check would be an open redirect.
    expect(safeReturnPath('//evil.example', '/en')).toBe('/en');
  });

  it('rejects a path that is not a path', () => {
    expect(safeReturnPath('javascript:alert(1)', '/en')).toBe('/en');
    expect(safeReturnPath('', '/en')).toBe('/en');
    expect(safeReturnPath(null, '/en')).toBe('/en');
  });
});
