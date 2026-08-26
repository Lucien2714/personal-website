import {NextResponse} from 'next/server';

import {apiCorsOrigins} from '@/lib/env';

/**
 * Response helpers for the public API.
 *
 * Every endpoint answers with the same envelope, because a client that has
 * learned to read one response has then learned to read all of them:
 *
 *   success: `{"data": ..., "meta": {...}}`
 *   failure: `{"error": {"code": "...", "message": "...", "details": ...}}`
 *
 * `code` is a stable machine-readable string; `message` is for a human reading
 * a log and may change wording at any time.
 */

/** Machine-readable failure codes returned by the API. */
export type ApiErrorCode =
  | 'bad_request'
  | 'unauthorized'
  | 'forbidden'
  | 'not_found'
  | 'method_not_allowed'
  | 'rate_limited'
  | 'payload_too_large'
  | 'unsupported_media_type'
  | 'internal_error';

/** HTTP status paired with each failure code. */
const STATUS_BY_CODE: Record<ApiErrorCode, number> = {
  bad_request: 400,
  unauthorized: 401,
  forbidden: 403,
  not_found: 404,
  method_not_allowed: 405,
  rate_limited: 429,
  payload_too_large: 413,
  unsupported_media_type: 415,
  internal_error: 500,
};

/** Pagination metadata attached to list responses. */
export interface ApiListMeta {
  page: number;
  perPage: number;
  total: number;
  totalPages: number;
}

/**
 * Resolves the `Access-Control-Allow-Origin` value for a request.
 *
 * When the allow-list is `*` the header echoes `*`, which browsers accept only
 * for credential-free requests - and this API never uses cookies, so that is
 * exactly the case. When specific origins are configured, the request's own
 * origin is echoed back if it is on the list, and omitted otherwise.
 *
 * @param requestOrigin Value of the request's `Origin` header, if any.
 */
export function resolveAllowedOrigin(
  requestOrigin: string | null,
): string | null {
  if (apiCorsOrigins.includes('*')) {
    return '*';
  }
  if (requestOrigin && apiCorsOrigins.includes(requestOrigin)) {
    return requestOrigin;
  }
  return null;
}

/** Builds the CORS headers for a request. */
export function corsHeaders(request: Request): Record<string, string> {
  const allowed = resolveAllowedOrigin(request.headers.get('origin'));
  if (!allowed) {
    return {};
  }

  return {
    'Access-Control-Allow-Origin': allowed,
    'Access-Control-Allow-Methods': 'GET, POST, PATCH, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Authorization, Content-Type',
    'Access-Control-Max-Age': '86400',
    // Caches must not serve one origin's response to another.
    Vary: 'Origin',
  };
}

/**
 * Builds a success response.
 *
 * @param request The incoming request, used to derive CORS headers.
 * @param data The payload.
 * @param options.meta Pagination metadata for list endpoints.
 * @param options.status HTTP status; defaults to 200.
 * @param options.headers Extra headers to merge in.
 */
export function apiSuccess<T>(
  request: Request,
  data: T,
  options: {
    meta?: ApiListMeta;
    status?: number;
    headers?: Record<string, string>;
  } = {},
): NextResponse {
  return NextResponse.json(options.meta ? {data, meta: options.meta} : {data}, {
    status: options.status ?? 200,
    headers: {
      ...corsHeaders(request),
      ...options.headers,
    },
  });
}

/**
 * Builds a failure response.
 *
 * @param request The incoming request, used to derive CORS headers.
 * @param code Stable failure code; also selects the HTTP status.
 * @param message Human-readable explanation.
 * @param details Optional structured detail, such as field-level errors.
 */
export function apiError(
  request: Request,
  code: ApiErrorCode,
  message: string,
  details?: unknown,
): NextResponse {
  return NextResponse.json(
    {error: {code, message, ...(details === undefined ? {} : {details})}},
    {
      status: STATUS_BY_CODE[code],
      headers: corsHeaders(request),
    },
  );
}

/** Answers a CORS preflight request. */
export function apiPreflight(request: Request): NextResponse {
  return new NextResponse(null, {status: 204, headers: corsHeaders(request)});
}
