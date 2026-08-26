import {defineApiRoute} from '@/lib/api/handler';
import {API_SCOPES} from '@/lib/api/keys';
import {apiPreflight, apiSuccess} from '@/lib/api/response';
import {env} from '@/lib/env';

/**
 * The API service document.
 *
 * A single unauthenticated request that tells a new client everything it needs
 * to get started: which endpoints exist, which of them need a key, and which
 * scopes a key can carry. It exists so that the answer to "what can I call?"
 * is the API itself rather than a document that has drifted out of date.
 */

export const GET = defineApiRoute({
  handler: ({request}) =>
    apiSuccess(request, {
      name: 'personal-website API',
      version: '1.0.0',
      documentation: `${env.NEXT_PUBLIC_SITE_URL}/api/v1/openapi.json`,
      locales: ['en', 'zh'],
      authentication: {
        scheme: 'Bearer',
        header: 'Authorization: Bearer <key>',
        note: 'Read endpoints are public. Write endpoints require a key created in the admin console.',
        scopes: API_SCOPES,
      },
      rateLimit: {
        window: '1 minute',
        limit: env.API_RATE_LIMIT_PER_MINUTE,
        scope: 'per API key, or per client address when unauthenticated',
      },
      endpoints: [
        {method: 'GET', path: '/api/v1/posts', auth: null},
        {method: 'POST', path: '/api/v1/posts', auth: 'posts:write'},
        {method: 'GET', path: '/api/v1/posts/{slug}', auth: null},
        {method: 'PATCH', path: '/api/v1/posts/{slug}', auth: 'posts:write'},
        {method: 'GET', path: '/api/v1/moments', auth: null},
        {method: 'POST', path: '/api/v1/moments', auth: 'moments:write'},
        {method: 'GET', path: '/api/v1/projects', auth: null},
        {method: 'GET', path: '/api/v1/projects/{slug}', auth: null},
        {method: 'GET', path: '/api/v1/pages/{slug}', auth: null},
        {method: 'GET', path: '/api/v1/categories', auth: null},
        {method: 'GET', path: '/api/v1/tags', auth: null},
      ],
    }),
});

/** Answers CORS preflight requests for browser-based clients. */
export function OPTIONS(request: Request) {
  return apiPreflight(request);
}
