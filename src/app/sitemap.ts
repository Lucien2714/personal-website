import type {MetadataRoute} from 'next';

import {locales} from '@/i18n/routing';
import {listProjects} from '@/lib/content/projects';
import {listNavPages} from '@/lib/content/pages';
import {listPosts} from '@/lib/content/posts';
import {env} from '@/lib/env';

/**
 * The XML sitemap.
 *
 * Every URL is listed once per locale with `alternates.languages` pointing at
 * its counterparts, which is what tells a search engine that `/en/posts/x` and
 * `/zh/posts/x` are the same document in two languages rather than duplicate
 * content.
 */

/** Regenerated on request; the post list changes whenever you publish. */
export const dynamic = 'force-dynamic';

/** Builds the sitemap entries. */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const site = env.NEXT_PUBLIC_SITE_URL;

  const [posts, projects, pages] = await Promise.all([
    listPosts({locale: 'EN', perPage: 100}),
    listProjects('EN'),
    listNavPages('EN'),
  ]);

  /** Produces one entry per locale for a locale-agnostic path. */
  const localised = (
    path: string,
    lastModified?: Date,
    priority = 0.7,
  ): MetadataRoute.Sitemap =>
    locales.map((locale) => ({
      url: `${site}/${locale}${path}`,
      lastModified,
      priority,
      alternates: {
        languages: Object.fromEntries(
          locales.map((other) => [other, `${site}/${other}${path}`]),
        ),
      },
    }));

  return [
    ...localised('', undefined, 1),
    ...localised('/posts', undefined, 0.9),
    ...localised('/moments', undefined, 0.6),
    ...localised('/projects', undefined, 0.8),
    ...localised('/archives', undefined, 0.5),
    ...pages.flatMap((page) => localised(`/${page.slug}`, undefined, 0.6)),
    ...posts.items.flatMap((post) =>
      localised(
        `/posts/${encodeURIComponent(post.slug)}`,
        post.publishedAt ?? undefined,
        0.8,
      ),
    ),
    ...projects.flatMap((project) =>
      localised(`/projects/${project.slug}`, undefined, 0.6),
    ),
  ];
}
