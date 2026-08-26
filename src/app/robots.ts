import type {MetadataRoute} from 'next';

import {env} from '@/lib/env';

/**
 * robots.txt.
 *
 * The console and the API are excluded from crawling: neither has anything a
 * search result should point at, and keeping them out spares the database a
 * steady trickle of pointless crawler traffic.
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: ['/api/', '/en/admin', '/zh/admin'],
      },
    ],
    sitemap: `${env.NEXT_PUBLIC_SITE_URL}/sitemap.xml`,
    host: env.NEXT_PUBLIC_SITE_URL,
  };
}
