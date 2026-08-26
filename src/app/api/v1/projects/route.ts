import {defineApiRoute} from '@/lib/api/handler';
import {apiPreflight, apiSuccess} from '@/lib/api/response';
import {readLocale, serializeProject} from '@/lib/api/serializers';
import {toAppLocale} from '@/i18n/routing';
import {listProjects} from '@/lib/content/projects';

/**
 * `/api/v1/projects`
 *
 * Lists published projects. Useful in the other direction from the embed
 * feature: a project's own site can pull its description and links from here
 * instead of keeping a second copy.
 */

export const GET = defineApiRoute({
  handler: async ({request, query}) => {
    const locale = readLocale(query);
    const featuredOnly = query.get('featured') === 'true';

    const projects = await listProjects(locale, {featuredOnly});

    return apiSuccess(
      request,
      projects.map((project) => serializeProject(project, toAppLocale(locale))),
    );
  },
});

/** Answers CORS preflight requests. */
export function OPTIONS(request: Request) {
  return apiPreflight(request);
}
