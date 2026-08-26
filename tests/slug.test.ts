import {describe, expect, it} from 'vitest';

import {slugify, uniqueSlug} from '@/lib/utils/slug';

describe('slugify', () => {
  it('lower-cases and hyphenates an English title', () => {
    expect(slugify('Hello World: A Beginning')).toBe('hello-world-a-beginning');
  });

  it('keeps Chinese characters instead of transliterating them', () => {
    // Percent-encoded UTF-8 paths are handled correctly by browsers and search
    // engines, and stay readable to the audience the post is written for.
    expect(slugify('我的第一篇文章')).toBe('我的第一篇文章');
  });

  it('handles a mixed-script title', () => {
    expect(slugify('Apex 猎杀者 RP 预测')).toBe('apex-猎杀者-rp-预测');
  });

  it('collapses punctuation and trims stray separators', () => {
    expect(slugify('  ***Hello---World!!!  ')).toBe('hello-world');
  });

  it('returns an empty string for input with nothing usable', () => {
    expect(slugify('   ')).toBe('');
    expect(slugify('')).toBe('');
  });

  it('truncates to the requested length without a trailing hyphen', () => {
    const slug = slugify('a'.repeat(50) + ' ' + 'b'.repeat(50), {
      maxLength: 51,
    });

    expect(slug.length).toBeLessThanOrEqual(51);
    expect(slug.endsWith('-')).toBe(false);
  });
});

describe('uniqueSlug', () => {
  it('returns the candidate when it is free', async () => {
    await expect(
      uniqueSlug('free', () => Promise.resolve(false)),
    ).resolves.toBe('free');
  });

  it('appends a counter until it finds a free slug', async () => {
    const taken = new Set(['post', 'post-2', 'post-3']);
    await expect(
      uniqueSlug('post', (candidate) => Promise.resolve(taken.has(candidate))),
    ).resolves.toBe('post-4');
  });

  it('falls back to a placeholder for an empty base', async () => {
    await expect(uniqueSlug('', () => Promise.resolve(false))).resolves.toBe(
      'untitled',
    );
  });
});
