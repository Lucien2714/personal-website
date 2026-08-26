import {z} from 'zod';

import {apiError, defineApiRoute, readPagination} from '@/lib/api/handler';
import {apiPreflight, apiSuccess} from '@/lib/api/response';
import {serializeMoment} from '@/lib/api/serializers';
import {saveMoment} from '@/lib/content/authoring';
import {listMoments} from '@/lib/content/moments';

/**
 * `/api/v1/moments`
 *
 * GET lists published moments. POST appends one, which makes the stream
 * writable from anywhere: a phone shortcut, a bot, or another of your apps.
 */

/** Body accepted by POST. */
const createMomentSchema = z.object({
  body: z.string().min(1).max(2000),
  images: z.array(z.string()).max(9).default([]),
  mood: z.string().max(16).optional(),
  location: z.string().max(120).optional(),
});

export const GET = defineApiRoute({
  handler: async ({request, query}) => {
    const {page, perPage} = readPagination(query);
    const result = await listMoments({page, perPage});

    return apiSuccess(request, result.items.map(serializeMoment), {
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
  scopes: ['moments:write'],
  bodySchema: createMomentSchema,
  handler: async ({request, body, key}) => {
    const authorId = key?.ownerId;
    if (!authorId) {
      return apiError(request, 'unauthorized', 'An API key is required.');
    }

    const id = await saveMoment({
      authorId,
      body: body.body,
      images: body.images,
      mood: body.mood ?? null,
      location: body.location ?? null,
      status: 'PUBLISHED',
    });

    return apiSuccess(request, {id}, {status: 201});
  },
});

/** Answers CORS preflight requests. */
export function OPTIONS(request: Request) {
  return apiPreflight(request);
}
