import type {Locale, PublishStatus} from '@/generated/prisma/enums';
import type {Prisma} from '@/generated/prisma/client';
import {db} from '@/lib/db';
import type {TocEntry} from '@/lib/content/markdown';

/**
 * Read-side queries for blog posts.
 *
 * Everything the public site renders goes through this module, which owns two
 * rules that would otherwise be re-implemented (and eventually mis-implemented)
 * at each call site:
 *
 *   1. **Visibility.** A post is public when it is not soft-deleted, its status
 *      is PUBLISHED or SCHEDULED, and its publish time has passed. Encoding
 *      "scheduled" as a future timestamp means a scheduled post goes live on
 *      its own, with no cron job to forget about.
 *   2. **Language fallback.** Not every post is translated. Asking for Chinese
 *      returns the Chinese rendition when it exists and the English one
 *      otherwise, flagged so the page can tell the reader what happened.
 */

/** Number of posts on one index page. */
export const POSTS_PER_PAGE = 10;

/** A post as rendered in a list. */
export interface PostSummary {
  id: string;
  slug: string;
  title: string;
  description: string | null;
  coverUrl: string | null;
  publishedAt: Date | null;
  readingMinutes: number;
  pinned: boolean;
  viewCount: number;
  /** Locale actually rendered, which may differ from the one requested. */
  locale: Locale;
  /** True when the requested locale had no translation. */
  isFallback: boolean;
  categories: TaxonomyRef[];
  tags: TaxonomyRef[];
}

/** A post as rendered on its own page. */
export interface PostDetail extends PostSummary {
  bodyHtml: string;
  toc: TocEntry[];
  updatedAt: Date;
  author: {displayName: string; avatarUrl: string | null; bio: string | null};
}

/** A category or tag reduced to what a chip needs. */
export interface TaxonomyRef {
  slug: string;
  name: string;
  color?: string | null;
}

/** Options accepted by {@link listPosts}. */
export interface ListPostsOptions {
  locale: Locale;
  /** One-based page number. */
  page?: number;
  perPage?: number;
  categorySlug?: string;
  tagSlug?: string;
  /** Case-insensitive substring match against title and description. */
  query?: string;
}

/** A page of results plus the totals a paginator needs. */
export interface Paginated<T> {
  items: T[];
  total: number;
  page: number;
  perPage: number;
  totalPages: number;
}

/** Builds the `where` clause that defines public visibility. */
function publicPostFilter(): Prisma.PostWhereInput {
  return {
    deletedAt: null,
    status: {in: ['PUBLISHED', 'SCHEDULED'] satisfies PublishStatus[]},
    publishedAt: {not: null, lte: new Date()},
  };
}

/** Selects the requested translation, falling back to any other language. */
const translationSelect = {
  select: {
    locale: true,
    slug: true,
    title: true,
    description: true,
    readingMinutes: true,
  },
} as const;

/** Reads a localised display name out of a `names` JSON column. */
function localisedName(names: Prisma.JsonValue, locale: Locale): string {
  if (names && typeof names === 'object' && !Array.isArray(names)) {
    const record = names as Record<string, unknown>;
    const preferred = record[locale];
    if (typeof preferred === 'string' && preferred.length > 0) {
      return preferred;
    }
    const first = Object.values(record).find(
      (value): value is string => typeof value === 'string',
    );
    if (first) {
      return first;
    }
  }
  return '';
}

/**
 * Picks the translation to display.
 *
 * @returns The matching translation and whether a fallback was used, or null
 *     when the post has no translations at all (which a published post never
 *     should, but the read path must not crash if one slips through).
 */
function pickTranslation<T extends {locale: Locale}>(
  translations: T[],
  requested: Locale,
): {translation: T; isFallback: boolean} | null {
  const exact = translations.find((item) => item.locale === requested);
  if (exact) {
    return {translation: exact, isFallback: false};
  }
  const fallback = translations[0];
  return fallback ? {translation: fallback, isFallback: true} : null;
}

/**
 * Lists published posts, newest first, with pinned posts hoisted to the top.
 *
 * @param options Locale, pagination and optional taxonomy or text filters.
 */
export async function listPosts(
  options: ListPostsOptions,
): Promise<Paginated<PostSummary>> {
  const page = Math.max(1, options.page ?? 1);
  const perPage = Math.min(50, Math.max(1, options.perPage ?? POSTS_PER_PAGE));

  const where: Prisma.PostWhereInput = {
    ...publicPostFilter(),
    ...(options.categorySlug
      ? {categories: {some: {slug: options.categorySlug}}}
      : {}),
    ...(options.tagSlug ? {tags: {some: {slug: options.tagSlug}}} : {}),
    ...(options.query
      ? {
          translations: {
            some: {
              OR: [
                {title: {contains: options.query, mode: 'insensitive'}},
                {description: {contains: options.query, mode: 'insensitive'}},
              ],
            },
          },
        }
      : {}),
  };

  const [total, rows] = await Promise.all([
    db.post.count({where}),
    db.post.findMany({
      where,
      orderBy: [{pinned: 'desc'}, {publishedAt: 'desc'}],
      skip: (page - 1) * perPage,
      take: perPage,
      select: {
        id: true,
        coverUrl: true,
        publishedAt: true,
        pinned: true,
        viewCount: true,
        translations: translationSelect,
        categories: {select: {slug: true, names: true, color: true}},
        tags: {select: {slug: true, names: true}},
      },
    }),
  ]);

  const items: PostSummary[] = [];
  for (const row of rows) {
    const picked = pickTranslation(row.translations, options.locale);
    if (!picked) {
      continue;
    }
    items.push({
      id: row.id,
      slug: picked.translation.slug,
      title: picked.translation.title,
      description: picked.translation.description,
      coverUrl: row.coverUrl,
      publishedAt: row.publishedAt,
      readingMinutes: picked.translation.readingMinutes,
      pinned: row.pinned,
      viewCount: row.viewCount,
      locale: picked.translation.locale,
      isFallback: picked.isFallback,
      categories: row.categories.map((category) => ({
        slug: category.slug,
        name: localisedName(category.names, options.locale),
        color: category.color,
      })),
      tags: row.tags.map((tag) => ({
        slug: tag.slug,
        name: localisedName(tag.names, options.locale),
      })),
    });
  }

  return {
    items,
    total,
    page,
    perPage,
    totalPages: Math.max(1, Math.ceil(total / perPage)),
  };
}

/**
 * Loads one published post by its slug.
 *
 * The slug is looked up across all locales, not only the requested one: a
 * Chinese reader following an English link should still land on the post
 * rather than a 404.
 *
 * @param slug URL segment of the post.
 * @param locale Language the reader asked for.
 * @returns The post, or null when no published post carries that slug.
 */
export async function getPostBySlug(
  slug: string,
  locale: Locale,
): Promise<PostDetail | null> {
  const row = await db.post.findFirst({
    where: {
      ...publicPostFilter(),
      translations: {some: {slug}},
    },
    select: {
      id: true,
      coverUrl: true,
      publishedAt: true,
      updatedAt: true,
      pinned: true,
      viewCount: true,
      translations: {
        select: {
          locale: true,
          slug: true,
          title: true,
          description: true,
          bodyHtml: true,
          tableOfContents: true,
          readingMinutes: true,
        },
      },
      categories: {select: {slug: true, names: true, color: true}},
      tags: {select: {slug: true, names: true}},
      author: {select: {displayName: true, avatarUrl: true, bio: true}},
    },
  });

  if (!row) {
    return null;
  }

  const picked = pickTranslation(row.translations, locale);
  if (!picked) {
    return null;
  }

  const {translation, isFallback} = picked;

  return {
    id: row.id,
    slug: translation.slug,
    title: translation.title,
    description: translation.description,
    bodyHtml: translation.bodyHtml,
    toc: Array.isArray(translation.tableOfContents)
      ? (translation.tableOfContents as unknown as TocEntry[])
      : [],
    coverUrl: row.coverUrl,
    publishedAt: row.publishedAt,
    updatedAt: row.updatedAt,
    readingMinutes: translation.readingMinutes,
    pinned: row.pinned,
    viewCount: row.viewCount,
    locale: translation.locale,
    isFallback,
    categories: row.categories.map((category) => ({
      slug: category.slug,
      name: localisedName(category.names, locale),
      color: category.color,
    })),
    tags: row.tags.map((tag) => ({
      slug: tag.slug,
      name: localisedName(tag.names, locale),
    })),
    author: row.author,
  };
}

/** The neighbours of a post in publication order. */
export interface PostNeighbours {
  previous: {slug: string; title: string} | null;
  next: {slug: string; title: string} | null;
}

/**
 * Finds the posts published immediately before and after a given one.
 *
 * @param publishedAt Publication timestamp of the current post.
 * @param locale Language used to resolve the neighbours' titles and slugs.
 */
export async function getPostNeighbours(
  publishedAt: Date | null,
  locale: Locale,
): Promise<PostNeighbours> {
  if (!publishedAt) {
    return {previous: null, next: null};
  }

  const [older, newer] = await Promise.all([
    db.post.findFirst({
      where: {...publicPostFilter(), publishedAt: {lt: publishedAt}},
      orderBy: {publishedAt: 'desc'},
      select: {translations: {select: {locale: true, slug: true, title: true}}},
    }),
    db.post.findFirst({
      where: {...publicPostFilter(), publishedAt: {gt: publishedAt}},
      orderBy: {publishedAt: 'asc'},
      select: {translations: {select: {locale: true, slug: true, title: true}}},
    }),
  ]);

  const resolve = (row: typeof older) => {
    if (!row) {
      return null;
    }
    const picked = pickTranslation(row.translations, locale);
    return picked
      ? {slug: picked.translation.slug, title: picked.translation.title}
      : null;
  };

  return {previous: resolve(older), next: resolve(newer)};
}

/**
 * Records a page view.
 *
 * Deliberately fire-and-forget: a failed counter update must never turn a
 * readable page into an error page.
 *
 * @param postId Identifier of the post that was read.
 */
export async function recordPostView(postId: string): Promise<void> {
  try {
    await db.post.update({
      where: {id: postId},
      data: {viewCount: {increment: 1}},
    });
  } catch {
    // Counting is best-effort.
  }
}

/** A year's worth of archive entries. */
export interface ArchiveYear {
  year: number;
  posts: Array<{slug: string; title: string; publishedAt: Date}>;
}

/**
 * Groups every published post by year, newest first.
 *
 * @param locale Language used to resolve titles and slugs.
 */
export async function listArchive(locale: Locale): Promise<ArchiveYear[]> {
  const rows = await db.post.findMany({
    where: publicPostFilter(),
    orderBy: {publishedAt: 'desc'},
    select: {
      publishedAt: true,
      translations: {select: {locale: true, slug: true, title: true}},
    },
  });

  const byYear = new Map<number, ArchiveYear['posts']>();

  for (const row of rows) {
    if (!row.publishedAt) {
      continue;
    }
    const picked = pickTranslation(row.translations, locale);
    if (!picked) {
      continue;
    }
    const year = row.publishedAt.getFullYear();
    const bucket = byYear.get(year) ?? [];
    bucket.push({
      slug: picked.translation.slug,
      title: picked.translation.title,
      publishedAt: row.publishedAt,
    });
    byYear.set(year, bucket);
  }

  return [...byYear.entries()]
    .sort(([left], [right]) => right - left)
    .map(([year, posts]) => ({year, posts}));
}

/** A taxonomy term with the number of posts filed under it. */
export interface TaxonomyWithCount extends TaxonomyRef {
  count: number;
}

/**
 * Lists categories that have at least one published post.
 *
 * @param locale Language used to resolve display names.
 */
export async function listCategories(
  locale: Locale,
): Promise<TaxonomyWithCount[]> {
  const rows = await db.category.findMany({
    select: {
      slug: true,
      names: true,
      color: true,
      _count: {select: {posts: {where: publicPostFilter()}}},
    },
    orderBy: {slug: 'asc'},
  });

  return rows
    .filter((row) => row._count.posts > 0)
    .map((row) => ({
      slug: row.slug,
      name: localisedName(row.names, locale),
      color: row.color,
      count: row._count.posts,
    }));
}

/**
 * Lists tags that have at least one published post, most used first.
 *
 * @param locale Language used to resolve display names.
 */
export async function listTags(locale: Locale): Promise<TaxonomyWithCount[]> {
  const rows = await db.tag.findMany({
    select: {
      slug: true,
      names: true,
      _count: {select: {posts: {where: publicPostFilter()}}},
    },
  });

  return rows
    .filter((row) => row._count.posts > 0)
    .map((row) => ({
      slug: row.slug,
      name: localisedName(row.names, locale),
      count: row._count.posts,
    }))
    .sort((left, right) => right.count - left.count);
}

/** Exposes the visibility filter to other read-side modules. */
export {publicPostFilter, localisedName};
