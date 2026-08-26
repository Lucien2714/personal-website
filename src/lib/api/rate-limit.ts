import {env} from '@/lib/env';

/**
 * A fixed-window rate limiter held in process memory.
 *
 * Scope and limits, stated plainly so nobody is surprised later:
 *
 *   * Counters live in this process. One container is the deployment target
 *     (see docker/docker-compose.yml), so that is accurate today. Running two
 *     replicas would give each its own budget, and the limit would need to
 *     move to Redis or to the reverse proxy.
 *   * A fixed window allows a burst of up to twice the limit across a window
 *     boundary. For an API whose purpose is to stop accidental hammering by
 *     your own side projects, that is an acceptable trade for keeping the
 *     implementation to a map and a timestamp.
 */

/** One caller's counter for the current window. */
interface Bucket {
  count: number;
  /** Epoch milliseconds at which this window ends. */
  resetAt: number;
}

/** Window length. Limits are expressed per minute. */
const WINDOW_MS = 60_000;

/** How many idle buckets to tolerate before sweeping the map. */
const SWEEP_THRESHOLD = 10_000;

const buckets = new Map<string, Bucket>();

/** Drops expired buckets so that the map cannot grow without bound. */
function sweep(now: number): void {
  for (const [key, bucket] of buckets) {
    if (bucket.resetAt <= now) {
      buckets.delete(key);
    }
  }
}

/** The outcome of a rate-limit check. */
export interface RateLimitResult {
  allowed: boolean;
  limit: number;
  remaining: number;
  /** Epoch seconds at which the current window resets. */
  resetAt: number;
  /** Seconds the caller should wait; only meaningful when not allowed. */
  retryAfter: number;
}

/**
 * Records a request against a caller's budget.
 *
 * @param identifier Stable caller identity: an API key id when authenticated,
 *     otherwise the client address.
 * @param limit Requests permitted per window; defaults to the configured value.
 */
export function checkRateLimit(
  identifier: string,
  limit: number = env.API_RATE_LIMIT_PER_MINUTE,
): RateLimitResult {
  const now = Date.now();

  if (buckets.size > SWEEP_THRESHOLD) {
    sweep(now);
  }

  const existing = buckets.get(identifier);
  const bucket =
    existing && existing.resetAt > now
      ? existing
      : {count: 0, resetAt: now + WINDOW_MS};

  bucket.count += 1;
  buckets.set(identifier, bucket);

  const allowed = bucket.count <= limit;

  return {
    allowed,
    limit,
    remaining: Math.max(0, limit - bucket.count),
    resetAt: Math.ceil(bucket.resetAt / 1000),
    retryAfter: Math.max(1, Math.ceil((bucket.resetAt - now) / 1000)),
  };
}

/**
 * Derives a caller identity from a request.
 *
 * Behind the reverse proxy in docker/, `X-Forwarded-For` carries the real
 * client address; its first entry is the one the proxy appended. The header is
 * only trustworthy because the proxy overwrites it, which is why the Caddy
 * configuration must not be changed to pass a client-supplied value through.
 *
 * @param request The incoming request.
 */
export function clientIdentifier(request: Request): string {
  const forwarded = request.headers.get('x-forwarded-for');
  if (forwarded) {
    const first = forwarded.split(',')[0]?.trim();
    if (first) {
      return first;
    }
  }

  return request.headers.get('x-real-ip') ?? 'unknown';
}

/** Formats the standard rate-limit headers. */
export function rateLimitHeaders(
  result: RateLimitResult,
): Record<string, string> {
  return {
    'X-RateLimit-Limit': String(result.limit),
    'X-RateLimit-Remaining': String(result.remaining),
    'X-RateLimit-Reset': String(result.resetAt),
    ...(result.allowed ? {} : {'Retry-After': String(result.retryAfter)}),
  };
}
