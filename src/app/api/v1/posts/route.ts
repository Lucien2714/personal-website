import {z} from 'zod';

import {apiError, defineApiRoute, readPagination} from '@/lib/api/handler';
import {apiPreflight, apiSuccess} from '@/lib/api/response';
import {readLocale, serializePostSummary} from '@/lib/api/serializers';
import {savePost} from '@/lib/content/authoring';
import {listPosts} from '@/lib/content/posts';
import {db} from '@/lib/db';

/**
 * `/api/v1/posts`
 *
 * GET lists published posts. POST creates one, and is the endpoint another of
 * your projects would call to publish on this site's behalf.
 */

/** Body accepted by POST. */
const createPostSchema = z.object({
  status: z.enum(['DRAFT', 'SCHEDULED', 'PUBLISHED']).default('DRAFT'),
  publishedAt: z.iso.datetime().optional(),
  pinned: z.boolean().default(false),
  coverUrl: z.string().optional(),
  categories: z.array(z.string().min(1)).default([]),
  tags: z.array(z.string().min(1)).default([]),
  translations: z
    .array(
      z.object({
        locale: z.enum(['EN', 'ZH']),
        title: z.string().min(1).max(300),
        slug: z.string().max(120).optional(),
        description: z.string().max(500).optional(),
        bodyMarkdown: z.string().min(1),
      }),
    )
    .min(1, 'Supply at least one translation.'),
});

export const GET = defineApiRoute({
  handler: async ({request, query}) => {
    const {page, perPage} = readPagination(query);

    const result = await listPosts({
      locale: readLocale(query),
      page,
      perPage,
      categorySlug: query.get('category') ?? undefined,
      tagSlug: query.get('tag') ?? undefined,
      query: query.get('q') ?? undefined,
    });

    return apiSuccess(request, result.items.map(serializePostSummary), {
      meta: {
        page: result.page,
        perPage: result.perPage,
        total: result.total,
        totalPages: result.totalPages,
      },
    });
  },
});

export const POST = defineApiRoute({
  scopes: ['posts:write'],
  bodySchema: createPostSchema,
  handler: async ({request, body, key}) => {
    // A key acts on behalf of its owner, so content created through the API is
    // attributed to a real account rather than to an anonymous integration.
    // The scope check in defineApiRoute has already rejected a keyless
    // request; this restates it for the type checker.
    const authorId = key?.ownerId;
    if (!authorId) {
      return apiError(request, 'unauthorized', 'An API key is required.');
    }

    const postId = await savePost({
      authorId,
      status: body.status,
      publishedAt: body.publishedAt ? new Date(body.publishedAt) : null,
      pinned: body.pinned,
      coverUrl: body.coverUrl ?? null,
      categories: body.categories,
      tags: body.tags,
      translations: body.translations,
    });

    const created = await db.post.findUniqueOrThrow({
      where: {id: postId},
      select: {translations: {select: {locale: true, slug: true}}},
    });

    return apiSuccess(
      request,
      {id: postId, translations: created.translations},
      {status: 201},
    );
  },
});

/** Answers CORS preflight requests. */
export function OPTIONS(request: Request) {
  return apiPreflight(request);
}
