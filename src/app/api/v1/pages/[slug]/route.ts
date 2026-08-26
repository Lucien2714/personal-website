import {apiError, defineApiRoute} from '@/lib/api/handler';
import {apiPreflight, apiSuccess} from '@/lib/api/response';
import {readLocale} from '@/lib/api/serializers';
import {toAppLocale} from '@/i18n/routing';
import {getPageBySlug} from '@/lib/content/pages';

/** `/api/v1/pages/{slug}` - one editable standalone page, such as `about`. */

export const GET = defineApiRoute<undefined, {slug: string}>({
  handler: async ({request, params, query}) => {
    const page = await getPageBySlug(params.slug, readLocale(query));

    if (!page) {
      return apiError(request, 'not_found', 'No published page has that slug.');
    }

    return apiSuccess(request, {
      slug: page.slug,
      locale: toAppLocale(page.locale),
      title: page.title,
      html: page.bodyHtml,
      updatedAt: page.updatedAt.toISOString(),
    });
  },
});

/** Answers CORS preflight requests. */
export function OPTIONS(request: Request) {
  return apiPreflight(request);
}
