import type {NextRequest} from 'next/server';

import {readBearerToken, verifyApiKey} from '@/lib/api/keys';
import {checkRateLimit, rateLimitHeaders} from '@/lib/api/rate-limit';
import {apiError, apiPreflight, apiSuccess} from '@/lib/api/response';
import {env} from '@/lib/env';
import {storeUpload} from '@/lib/media/storage';

/**
 * `/api/v1/media` - programmatic file upload.
 *
 * This route does not use `defineApiRoute`, because that helper assumes a JSON
 * body and this endpoint takes `multipart/form-data`. The authentication and
 * rate-limiting steps are therefore repeated here rather than shared; the
 * duplication is deliberate and small, and the alternative - a body-parsing
 * strategy parameter threaded through the shared helper - would complicate
 * every other endpoint to serve this one.
 */

/** Maps a storage rejection onto the API's error vocabulary. */
const REJECTION_STATUS = {
  unsupported_type: 'unsupported_media_type',
  too_large: 'payload_too_large',
  empty: 'bad_request',
  write_failed: 'internal_error',
} as const;

/**
 * Accepts one file and returns its public URL.
 *
 * Send it as `multipart/form-data` with a single `file` field:
 *
 *     curl -X POST https://example.com/api/v1/media \
 *       -H "Authorization: Bearer pws_..." \
 *       -F file=@screenshot.png
 */
export async function POST(request: NextRequest): Promise<Response> {
  const token = readBearerToken(request);
  if (!token) {
    return apiError(
      request,
      'unauthorized',
      'This endpoint requires an API key. Send it as `Authorization: Bearer <key>`.',
    );
  }

  const key = await verifyApiKey(token);
  if (!key) {
    return apiError(
      request,
      'unauthorized',
      'The supplied API key is invalid, revoked or expired.',
    );
  }

  if (!key.scopes.includes('media:write')) {
    return apiError(
      request,
      'forbidden',
      'This key is missing the required scope: media:write.',
    );
  }

  const limit = checkRateLimit(`key:${key.id}`);
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

  const contentType = request.headers.get('content-type') ?? '';
  if (!contentType.includes('multipart/form-data')) {
    return apiError(
      request,
      'unsupported_media_type',
      'Send the file as multipart/form-data with a `file` field.',
    );
  }

  // Rejects an oversized upload before its body is buffered into memory. The
  // header can lie, so storeUpload checks the real size again.
  const declaredLength = Number(request.headers.get('content-length') ?? '0');
  if (declaredLength > env.UPLOAD_MAX_BYTES) {
    return apiError(
      request,
      'payload_too_large',
      `Files must be ${Math.floor(env.UPLOAD_MAX_BYTES / 1024 / 1024)} MB or smaller.`,
    );
  }

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return apiError(request, 'bad_request', 'The request body is malformed.');
  }

  const file = formData.get('file');
  if (!(file instanceof File)) {
    return apiError(request, 'bad_request', 'No `file` field was supplied.');
  }

  const altText = formData.get('altText');
  const result = await storeUpload(
    file,
    key.ownerId,
    typeof altText === 'string' ? altText : undefined,
  );

  if (!result.ok) {
    return apiError(request, REJECTION_STATUS[result.reason], result.message);
  }

  return apiSuccess(
    request,
    {
      id: result.id,
      url: new URL(result.url, env.NEXT_PUBLIC_SITE_URL).toString(),
      deduplicated: result.deduplicated,
    },
    {status: result.deduplicated ? 200 : 201, headers: rateLimitHeaders(limit)},
  );
}

/** Answers CORS preflight requests. */
export function OPTIONS(request: Request) {
  return apiPreflight(request);
}
