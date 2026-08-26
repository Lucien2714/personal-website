import {apiError, defineApiRoute} from '@/lib/api/handler';
import {apiPreflight, apiSuccess} from '@/lib/api/response';
import {readLocale, serializePostDetail} from '@/lib/api/serializers';
import {getPostBySlug} from '@/lib/content/posts';

/**
 * `/api/v1/posts/{slug}`
 *
 * Returns one published post, including its rendered HTML, so a consumer can
 * mirror a post elsewhere without re-implementing the Markdown pipeline.
 */

export const GET = defineApiRoute<undefined, {slug: string}>({
  handler: async ({request, params, query}) => {
    const post = await getPostBySlug(
      decodeURIComponent(params.slug),
      readLocale(query),
    );

    if (!post) {
      return apiError(request, 'not_found', 'No published post has that slug.');
    }

    return apiSuccess(request, serializePostDetail(post));
  },
});

/** Answers CORS preflight requests. */
export function OPTIONS(request: Request) {
  return apiPreflight(request);
}
