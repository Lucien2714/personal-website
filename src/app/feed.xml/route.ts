import {listPosts} from '@/lib/content/posts';
import {getSiteSettings} from '@/lib/content/settings';
import {env} from '@/lib/env';

/**
 * The RSS 2.0 feed.
 *
 * Serves both languages from one document. A feed reader has no locale to
 * negotiate with, so splitting the feed in two would mean every subscriber
 * silently missing half the site; instead each item declares its own
 * `xml:lang` and links to its localised page.
 */

/** Escapes text for inclusion in an XML text node or attribute. */
function escapeXml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

/** How many of the most recent posts the feed carries. */
const FEED_SIZE = 20;

/** Builds the feed document. */
export async function GET(): Promise<Response> {
  const settings = await getSiteSettings();

  // Both locales are fetched and merged so that a post written only in Chinese
  // still reaches subscribers.
  const [english, chinese] = await Promise.all([
    listPosts({locale: 'EN', perPage: FEED_SIZE}),
    listPosts({locale: 'ZH', perPage: FEED_SIZE}),
  ]);

  const seen = new Set<string>();
  const items = [...english.items, ...chinese.items]
    .filter((post) => {
      if (seen.has(post.id)) {
        return false;
      }
      seen.add(post.id);
      return true;
    })
    .sort(
      (left, right) =>
        (right.publishedAt?.getTime() ?? 0) -
        (left.publishedAt?.getTime() ?? 0),
    )
    .slice(0, FEED_SIZE);

  const site = env.NEXT_PUBLIC_SITE_URL;

  const body = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>${escapeXml(settings.authorName)}</title>
    <link>${escapeXml(site)}</link>
    <description>${escapeXml(settings.heroSubline.en || 'Personal site')}</description>
    <language>en</language>
    <lastBuildDate>${new Date().toUTCString()}</lastBuildDate>
    <atom:link href="${escapeXml(`${site}/feed.xml`)}" rel="self" type="application/rss+xml"/>
${items
  .map((post) => {
    const locale = post.locale === 'ZH' ? 'zh' : 'en';
    const url = `${site}/${locale}/posts/${encodeURIComponent(post.slug)}`;
    return `    <item>
      <title>${escapeXml(post.title)}</title>
      <link>${escapeXml(url)}</link>
      <guid isPermaLink="true">${escapeXml(url)}</guid>
      <pubDate>${post.publishedAt?.toUTCString() ?? ''}</pubDate>
      <description>${escapeXml(post.description ?? '')}</description>
${post.categories
  .map((category) => `      <category>${escapeXml(category.name)}</category>`)
  .join('\n')}
    </item>`;
  })
  .join('\n')}
  </channel>
</rss>
`;

  return new Response(body, {
    headers: {
      'Content-Type': 'application/rss+xml; charset=utf-8',
      // Readers poll often; a short shared cache spares the database.
      'Cache-Control': 'public, max-age=0, s-maxage=600',
    },
  });
}
