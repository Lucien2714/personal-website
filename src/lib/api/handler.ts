import type {NextRequest, NextResponse} from 'next/server';
import type {ZodType} from 'zod';

import {
  type ApiScope,
  type VerifiedKey,
  readBearerToken,
  verifyApiKey,
} from '@/lib/api/keys';
import {
  checkRateLimit,
  clientIdentifier,
  rateLimitHeaders,
} from '@/lib/api/rate-limit';
import {apiError, apiSuccess} from '@/lib/api/response';
import {isProduction} from '@/lib/env';

/**
 * The middleware chain every `/api/v1` route runs through.
 *
 * Each endpoint would otherwise repeat the same four concerns - rate limiting,
 * authentication, body validation, error translation - and would eventually
 * repeat one of them incorrectly. `defineApiRoute` applies them in a fixed
 * order and leaves the handler with nothing but the request and its already
 * validated input.
 */

/** What a handler receives once the chain has done its work. */
export interface ApiContext<TBody, TParams> {
  request: NextRequest;
  /** Parsed and validated request body; `undefined` when no schema was given. */
  body: TBody;
  /** Route parameters, awaited for you. */
  params: TParams;
  /** Parsed query string. */
  query: URLSearchParams;
  /** The authenticated key, or null on a public endpoint. */
  key: VerifiedKey | null;
}

/** Configuration for one endpoint. */
export interface ApiRouteConfig<TBody, TParams> {
  /**
   * Scopes required to call this endpoint. An empty array (or omitting the
   * field) makes the endpoint public.
   */
  scopes?: ApiScope[];
  /** Schema applied to the JSON request body. */
  bodySchema?: ZodType<TBody>;
  /** The endpoint itself. */
  handler: (
    context: ApiContext<TBody, TParams>,
  ) => Promise<NextResponse> | NextResponse;
}

/** Shape Next.js passes as the second argument to a route handler. */
interface RouteHandlerContext<TParams> {
  params: Promise<TParams>;
}

/**
 * Wraps a handler with authentication, rate limiting and error handling.
 *
 * @param config Endpoint configuration.
 * @returns A Next.js route handler.
 */
export function defineApiRoute<TBody = undefined, TParams = object>(
  config: ApiRouteConfig<TBody, TParams>,
) {
  return async function route(
    request: NextRequest,
    context?: RouteHandlerContext<TParams>,
  ): Promise<NextResponse> {
    const requiredScopes = config.scopes ?? [];

    try {
      // --- Authentication ------------------------------------------------
      let key: VerifiedKey | null = null;
      const token = readBearerToken(request);

      if (token) {
        key = await verifyApiKey(token);
        if (!key) {
          return apiError(
            request,
            'unauthorized',
            'The supplied API key is invalid, revoked or expired.',
          );
        }
      }

      if (requiredScopes.length > 0) {
        if (!key) {
          return apiError(
            request,
            'unauthorized',
            'This endpoint requires an API key. Send it as `Authorization: Bearer <key>`.',
          );
        }

        const missing = requiredScopes.filter(
          (scope) => !key.scopes.includes(scope),
        );
        if (missing.length > 0) {
          return apiError(
            request,
            'forbidden',
            `This key is missing the required scope(s): ${missing.join(', ')}.`,
          );
        }
      }

      // --- Rate limiting -------------------------------------------------
      // Authenticated callers are budgeted per key, anonymous ones per address,
      // so one noisy client cannot spend everybody else's allowance.
      const limit = checkRateLimit(
        key ? `key:${key.id}` : `ip:${clientIdentifier(request)}`,
      );

      if (!limit.allowed) {
        const response = apiError(
          request,
          'rate_limited',
          'Too many requests. Slow down and try again shortly.',
        );
        for (const [name, value] of Object.entries(rateLimitHeaders(limit))) {
          response.headers.set(name, value);
        }
        return response;
      }

      // --- Body validation -----------------------------------------------
      let body = undefined as TBody;
      if (config.bodySchema) {
        const contentType = request.headers.get('content-type') ?? '';
        if (!contentType.includes('application/json')) {
          return apiError(
            request,
            'unsupported_media_type',
            'Send the request body as application/json.',
          );
        }

        let raw: unknown;
        try {
          raw = await request.json();
        } catch {
          return apiError(
            request,
            'bad_request',
            'The request body is not valid JSON.',
          );
        }

        const parsed = config.bodySchema.safeParse(raw);
        if (!parsed.success) {
          return apiError(
            request,
            'bad_request',
            'The request body failed validation.',
            parsed.error.issues.map((issue) => ({
              path: issue.path.join('.'),
              message: issue.message,
            })),
          );
        }
        body = parsed.data;
      }

      // --- Handler --------------------------------------------------------
      const params = ((await context?.params) ?? {}) as TParams;
      const response = await config.handler({
        request,
        body,
        params,
        query: request.nextUrl.searchParams,
        key,
      });

      for (const [name, value] of Object.entries(rateLimitHeaders(limit))) {
        response.headers.set(name, value);
      }

      return response;
    } catch (error) {
      // One place where an unexpected failure becomes a well-formed response.
      // The detail is logged for the operator and withheld from the caller in
      // production, where a stack trace is an information leak.
      console.error('[api] unhandled error', error);

      return apiError(
        request,
        'internal_error',
        'The server failed to handle this request.',
        isProduction || !(error instanceof Error) ? undefined : error.message,
      );
    }
  };
}

/**
 * Parses `page` and `perPage` out of a query string.
 *
 * @param query The request's search parameters.
 * @param defaultPerPage Page size used when the caller does not ask for one.
 */
export function readPagination(
  query: URLSearchParams,
  defaultPerPage = 20,
): {page: number; perPage: number} {
  const page = Math.max(1, Number.parseInt(query.get('page') ?? '1', 10) || 1);
  const requested =
    Number.parseInt(query.get('perPage') ?? String(defaultPerPage), 10) ||
    defaultPerPage;

  // A cap is not politeness, it is protection: without one, `perPage=100000`
  // is a one-request denial of service.
  return {page, perPage: Math.min(100, Math.max(1, requested))};
}

export {apiSuccess, apiError};
