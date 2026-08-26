import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';

import {
  checkRateLimit,
  clientIdentifier,
  rateLimitHeaders,
} from '@/lib/api/rate-limit';

describe('checkRateLimit', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  /** Each test uses a fresh identifier, since buckets are module state. */
  const identifier = () => `test-${Math.random().toString(36).slice(2)}`;

  it('allows requests up to the limit and refuses the next one', () => {
    const id = identifier();

    for (let attempt = 1; attempt <= 3; attempt += 1) {
      expect(checkRateLimit(id, 3).allowed).toBe(true);
    }

    expect(checkRateLimit(id, 3).allowed).toBe(false);
  });

  it('counts down the remaining allowance', () => {
    const id = identifier();

    expect(checkRateLimit(id, 5).remaining).toBe(4);
    expect(checkRateLimit(id, 5).remaining).toBe(3);
  });

  it('never reports a negative remaining allowance', () => {
    const id = identifier();

    checkRateLimit(id, 1);
    checkRateLimit(id, 1);
    expect(checkRateLimit(id, 1).remaining).toBe(0);
  });

  it('starts a fresh window once the old one has passed', () => {
    const id = identifier();

    checkRateLimit(id, 1);
    expect(checkRateLimit(id, 1).allowed).toBe(false);

    vi.advanceTimersByTime(61_000);
    expect(checkRateLimit(id, 1).allowed).toBe(true);
  });

  it('budgets each caller separately', () => {
    const first = identifier();
    const second = identifier();

    checkRateLimit(first, 1);
    expect(checkRateLimit(first, 1).allowed).toBe(false);
    expect(checkRateLimit(second, 1).allowed).toBe(true);
  });
});

describe('clientIdentifier', () => {
  it('reads the first entry of X-Forwarded-For', () => {
    const request = new Request('http://localhost', {
      headers: {'x-forwarded-for': '203.0.113.7, 10.0.0.1'},
    });

    expect(clientIdentifier(request)).toBe('203.0.113.7');
  });

  it('falls back to X-Real-IP', () => {
    const request = new Request('http://localhost', {
      headers: {'x-real-ip': '198.51.100.4'},
    });

    expect(clientIdentifier(request)).toBe('198.51.100.4');
  });

  it('reports "unknown" when the proxy supplied nothing', () => {
    expect(clientIdentifier(new Request('http://localhost'))).toBe('unknown');
  });
});

describe('rateLimitHeaders', () => {
  it('omits Retry-After while the caller is still within budget', () => {
    const headers = rateLimitHeaders({
      allowed: true,
      limit: 10,
      remaining: 9,
      resetAt: 1_000,
      retryAfter: 30,
    });

    expect(headers['X-RateLimit-Limit']).toBe('10');
    expect(headers['Retry-After']).toBeUndefined();
  });

  it('includes Retry-After once the caller is over budget', () => {
    const headers = rateLimitHeaders({
      allowed: false,
      limit: 10,
      remaining: 0,
      resetAt: 1_000,
      retryAfter: 30,
    });

    expect(headers['Retry-After']).toBe('30');
  });
});
