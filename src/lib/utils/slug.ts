import slugifyLib from 'slugify';

/**
 * Slug generation for post, project and taxonomy URLs.
 *
 * Chinese titles are the awkward case: transliterating them produces long,
 * unreadable pinyin, while dropping the characters leaves an empty string. The
 * compromise here keeps CJK characters verbatim - browsers and search engines
 * handle percent-encoded UTF-8 paths correctly, and `/zh/posts/我的第一篇`
 * stays legible to the reader it is written for.
 */

/** Matches characters that may appear in a slug unescaped. */
const CJK_RANGE =
  '\\u3040-\\u30ff\\u3400-\\u4dbf\\u4e00-\\u9fff\\uac00-\\ud7af';

/**
 * Converts a title into a URL slug.
 *
 * @param input The human-readable title.
 * @param options.maxLength Truncation limit; defaults to 80 characters.
 * @returns A lower-case slug, or an empty string if nothing usable remained.
 */
export function slugify(
  input: string,
  options: {maxLength?: number} = {},
): string {
  const maxLength = options.maxLength ?? 80;
  const trimmed = input.trim();
  if (trimmed.length === 0) {
    return '';
  }

  const hasCjk = new RegExp(`[${CJK_RANGE}]`).test(trimmed);

  const slug = hasCjk
    ? trimmed
        .toLowerCase()
        // Keep CJK, ASCII alphanumerics and hyphens; everything else becomes
        // a separator.
        .replace(new RegExp(`[^${CJK_RANGE}a-z0-9]+`, 'g'), '-')
        .replace(/^-+|-+$/g, '')
    : slugifyLib(trimmed, {lower: true, strict: true, trim: true});

  return slug.slice(0, maxLength).replace(/-+$/, '');
}

/**
 * Appends a numeric suffix until the slug is unique.
 *
 * @param base The candidate slug.
 * @param exists Predicate that reports whether a slug is already taken.
 * @returns The first available slug in the series `base`, `base-2`, `base-3`.
 */
export async function uniqueSlug(
  base: string,
  exists: (candidate: string) => Promise<boolean>,
): Promise<string> {
  const seed = base.length > 0 ? base : 'untitled';

  if (!(await exists(seed))) {
    return seed;
  }

  for (let suffix = 2; suffix < 1000; suffix += 1) {
    const candidate = `${seed}-${suffix}`;
    if (!(await exists(candidate))) {
      return candidate;
    }
  }

  // Astronomically unlikely; fall back to a timestamp rather than looping.
  return `${seed}-${Date.now()}`;
}
