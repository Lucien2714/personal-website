import {defineApiRoute} from '@/lib/api/handler';
import {apiPreflight, apiSuccess} from '@/lib/api/response';
import {readLocale} from '@/lib/api/serializers';
import {listCategories} from '@/lib/content/posts';

/** `/api/v1/categories` - categories with at least one published post. */

export const GET = defineApiRoute({
  handler: async ({request, query}) => {
    const categories = await listCategories(readLocale(query));

    return apiSuccess(
      request,
      categories.map(({slug, name, count, color}) => ({
        slug,
        name,
        count,
        color: color ?? null,
      })),
    );
  },
});

/** Answers CORS preflight requests. */
export function OPTIONS(request: Request) {
  return apiPreflight(request);
}
