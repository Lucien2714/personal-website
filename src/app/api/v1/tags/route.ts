import {defineApiRoute} from '@/lib/api/handler';
import {apiPreflight, apiSuccess} from '@/lib/api/response';
import {readLocale} from '@/lib/api/serializers';
import {listTags} from '@/lib/content/posts';

/** `/api/v1/tags` - tags with at least one published post, most used first. */

export const GET = defineApiRoute({
  handler: async ({request, query}) => {
    const tags = await listTags(readLocale(query));

    return apiSuccess(
      request,
      tags.map(({slug, name, count}) => ({slug, name, count})),
    );
  },
});

/** Answers CORS preflight requests. */
export function OPTIONS(request: Request) {
  return apiPreflight(request);
}
