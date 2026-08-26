import path from 'node:path';

import {defineConfig} from 'vitest/config';

/**
 * Test configuration.
 *
 * The suite covers pure logic - hashing, slugs, Markdown rendering, rate
 * limiting, serialisation - and deliberately does not spin up a database or a
 * browser. Those would turn a two-second feedback loop into a two-minute one,
 * and the parts of this code base most likely to break silently are exactly
 * the pure ones.
 */
export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
    setupFiles: ['tests/setup.ts'],
    // Password hashing is intentionally slow; the default 5 s can be tight.
    testTimeout: 20_000,
  },
  resolve: {
    alias: {
      '@': path.resolve(import.meta.dirname, 'src'),
    },
  },
});
