import type {Prisma} from '@/generated/prisma/client';
import {db} from '@/lib/db';
import type {Paginated} from '@/lib/content/posts';

/**
 * Read-side queries for moments, the short-form half of the site.
 *
 * Moments carry no translations and no slugs; they are a dated stream, so the
 * only access patterns are "the newest N" and "one page of them".
 */

/** How many moments one page of the stream holds. */
export const MOMENTS_PER_PAGE = 20;

/** A moment as rendered in the stream. */
export interface MomentView {
  id: string;
  body: string;
  images: string[];
  mood: string | null;
  location: string | null;
  createdAt: Date;
}

/** Visibility filter shared by every public moment query. */
function publicMomentFilter(): Prisma.MomentWhereInput {
  return {deletedAt: null, status: 'PUBLISHED'};
}

/**
 * Normalises the `images` JSON column into a string array.
 *
 * The column is JSON rather than a relation because the list is short, always
 * read whole, and never queried by element. That flexibility costs one guard
 * here: anything that is not an array of strings is treated as empty.
 */
function toImageList(value: Prisma.JsonValue): string[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return value.filter((item): item is string => typeof item === 'string');
}

/** Converts a database row into the shape the UI consumes. */
function toMomentView(row: {
  id: string;
  body: string;
  images: Prisma.JsonValue;
  mood: string | null;
  location: string | null;
  createdAt: Date;
}): MomentView {
  return {
    id: row.id,
    body: row.body,
    images: toImageList(row.images),
    mood: row.mood,
    location: row.location,
    createdAt: row.createdAt,
  };
}

/**
 * Returns one page of published moments, newest first.
 *
 * @param options.page One-based page number.
 * @param options.perPage Items per page, capped at 50.
 */
export async function listMoments(
  options: {page?: number; perPage?: number} = {},
): Promise<Paginated<MomentView>> {
  const page = Math.max(1, options.page ?? 1);
  const perPage = Math.min(
    50,
    Math.max(1, options.perPage ?? MOMENTS_PER_PAGE),
  );
  const where = publicMomentFilter();

  const [total, rows] = await Promise.all([
    db.moment.count({where}),
    db.moment.findMany({
      where,
      orderBy: {createdAt: 'desc'},
      skip: (page - 1) * perPage,
      take: perPage,
      select: {
        id: true,
        body: true,
        images: true,
        mood: true,
        location: true,
        createdAt: true,
      },
    }),
  ]);

  return {
    items: rows.map(toMomentView),
    total,
    page,
    perPage,
    totalPages: Math.max(1, Math.ceil(total / perPage)),
  };
}

/**
 * Returns the most recent moments, for the home page teaser.
 *
 * @param limit How many to return.
 */
export async function listRecentMoments(limit = 4): Promise<MomentView[]> {
  const rows = await db.moment.findMany({
    where: publicMomentFilter(),
    orderBy: {createdAt: 'desc'},
    take: limit,
    select: {
      id: true,
      body: true,
      images: true,
      mood: true,
      location: true,
      createdAt: true,
    },
  });

  return rows.map(toMomentView);
}

export {publicMomentFilter};
