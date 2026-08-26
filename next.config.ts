import createNextIntlPlugin from 'next-intl/plugin';
import type {NextConfig} from 'next';

/**
 * Wires next-intl into the build so that server components can resolve the
 * active locale and its message catalogue.
 */
const withNextIntl = createNextIntlPlugin('./src/i18n/request.ts');

const nextConfig: NextConfig = {
  // `standalone` emits a self-contained server bundle, which keeps the
  // production Docker image small (see docker/Dockerfile).
  output: 'standalone',

  // Fail the production build on type errors rather than shipping them.
  // Linting is run separately (npm run lint) because Next.js 16 no longer
  // accepts an `eslint` key here.
  typescript: {ignoreBuildErrors: false},

  // Uploaded media is served from the app itself, so no remote patterns are
  // needed by default. Add entries here if you move media to a CDN.
  images: {
    remotePatterns: [],
  },

  /**
   * Security headers.
   *
   * A site-wide `Content-Security-Policy` is deliberately not set here: the
   * project pages embed third-party applications in iframes, and a single
   * static policy would either forbid that or be too loose to be worth having.
   * The uploads rule below is the one place a policy is both necessary and
   * precisely expressible.
   */
  // Next.js types this hook as returning a promise, so it is declared async
  // even though it has nothing to await.
  // eslint-disable-next-line @typescript-eslint/require-await
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          {key: 'X-Content-Type-Options', value: 'nosniff'},
          {key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin'},
          {
            key: 'Permissions-Policy',
            value: 'camera=(), microphone=(), geolocation=()',
          },
        ],
      },
      {
        // Uploaded files are served from this origin, and an SVG is a document
        // that can carry script. This policy makes any such script inert while
        // still allowing SVGs to be used as images.
        source: '/uploads/:path*',
        headers: [
          {
            key: 'Content-Security-Policy',
            value:
              "default-src 'none'; img-src 'self' data:; style-src 'unsafe-inline'; sandbox",
          },
          {key: 'X-Content-Type-Options', value: 'nosniff'},
        ],
      },
    ];
  },
};

export default withNextIntl(nextConfig);
