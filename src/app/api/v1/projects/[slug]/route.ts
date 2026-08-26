import {apiError, defineApiRoute} from '@/lib/api/handler';
import {apiPreflight, apiSuccess} from '@/lib/api/response';
import {readLocale, serializeProject} from '@/lib/api/serializers';
import {toAppLocale} from '@/i18n/routing';
import {getProjectBySlug} from '@/lib/content/projects';

/** `/api/v1/projects/{slug}` - one published project. */

export const GET = defineApiRoute<undefined, {slug: string}>({
  handler: async ({request, params, query}) => {
    const locale = readLocale(query);
    const project = await getProjectBySlug(params.slug, locale);

    if (!project) {
      return apiError(
        request,
        'not_found',
        'No published project has that slug.',
      );
    }

    return apiSuccess(request, serializeProject(project, toAppLocale(locale)));
  },
});

/** Answers CORS preflight requests. */
export function OPTIONS(request: Request) {
  return apiPreflight(request);
}
