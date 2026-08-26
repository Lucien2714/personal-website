/**
 * Test bootstrap.
 *
 * `src/lib/env.ts` validates the environment at import time and throws if it
 * is incomplete, which is the behaviour we want in production and an obstacle
 * in a unit test. Supplying placeholders here keeps the modules under test
 * importable without giving them a real database or a real secret - nothing in
 * the suite connects to either.
 */

// `process.env.NODE_ENV` is typed as read-only, which is a useful rule for
// application code and exactly the rule a test bootstrap needs to step around.
const testEnv = process.env as Record<string, string | undefined>;

testEnv.NODE_ENV ??= 'test';
testEnv.DATABASE_URL ??=
  'postgresql://test:test@127.0.0.1:5432/test?schema=public';
testEnv.AUTH_SECRET ??= 'test-only-secret-value-that-is-long-enough-to-pass';
testEnv.NEXT_PUBLIC_SITE_URL ??= 'http://localhost:3000';
