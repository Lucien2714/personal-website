import type {Locale} from '@/generated/prisma/enums';
import {
  type AppLocale,
  isAppLocale,
  toAppLocale,
  toPrismaLocale,
} from '@/i18n/routing';
import type {MomentView} from '@/lib/content/moments';
import type {PostDetail, PostSummary} from '@/lib/content/posts';
import type {ProjectView} from '@/lib/content/projects';
import {env} from '@/lib/env';

/**
 * Wire formats for the public API.
 *
 * The internal view types are shaped for React components: `Date` objects,
 * nullable fields, an `isFallback` flag. The API is a contract with programs
 * that this repository does not control, so it gets its own explicit shape -
 * ISO strings, absolute URLs, lower-case locales - and changing an internal
 * type can no longer silently change what those programs receive.
 */

/** Reads the `locale` query parameter, defaulting to English. */
export function readLocale(query: URLSearchParams): Locale {
  const requested = query.get('locale')?.toLowerCase() ?? 'en';
  return toPrismaLocale(isAppLocale(requested) ? requested : 'en');
}

/** Turns a site-relative path into an absolute URL. */
function absoluteUrl(path: string | null): string | null {
  if (!path) {
    return null;
  }
  return path.startsWith('http')
    ? path
    : new URL(path, env.NEXT_PUBLIC_SITE_URL).toString();
}

/** Builds the canonical page URL for a post. */
function postUrl(slug: string, locale: AppLocale): string {
  return `${env.NEXT_PUBLIC_SITE_URL}/${locale}/posts/${encodeURIComponent(slug)}`;
}

/** A post as it appears in an API list response. */
export interface ApiPostSummary {
  id: string;
  slug: string;
  locale: AppLocale;
  title: string;
  description: string | null;
  url: string;
  coverUrl: string | null;
  publishedAt: string | null;
  readingMinutes: number;
  pinned: boolean;
  viewCount: number;
  categories: Array<{slug: string; name: string}>;
  tags: Array<{slug: string; name: string}>;
}

/** Serialises a post summary. */
export function serializePostSummary(post: PostSummary): ApiPostSummary {
  const locale = toAppLocale(post.locale);

  return {
    id: post.id,
    slug: post.slug,
    locale,
    title: post.title,
    description: post.description,
    url: postUrl(post.slug, locale),
    coverUrl: absoluteUrl(post.coverUrl),
    publishedAt: post.publishedAt?.toISOString() ?? null,
    readingMinutes: post.readingMinutes,
    pinned: post.pinned,
    viewCount: post.viewCount,
    categories: post.categories.map(({slug, name}) => ({slug, name})),
    tags: post.tags.map(({slug, name}) => ({slug, name})),
  };
}

/** A post as it appears in an API detail response. */
export interface ApiPostDetail extends ApiPostSummary {
  html: string;
  toc: Array<{id: string; text: string; depth: number}>;
  updatedAt: string;
  author: {name: string; avatarUrl: string | null};
}

/** Serialises a full post. */
export function serializePostDetail(post: PostDetail): ApiPostDetail {
  return {
    ...serializePostSummary(post),
    html: post.bodyHtml,
    toc: post.toc,
    updatedAt: post.updatedAt.toISOString(),
    author: {
      name: post.author.displayName,
      avatarUrl: absoluteUrl(post.author.avatarUrl),
    },
  };
}

/** A moment as it appears in an API response. */
export interface ApiMoment {
  id: string;
  body: string;
  images: string[];
  mood: string | null;
  location: string | null;
  createdAt: string;
}

/** Serialises a moment. */
export function serializeMoment(moment: MomentView): ApiMoment {
  return {
    id: moment.id,
    body: moment.body,
    images: moment.images
      .map((image) => absoluteUrl(image))
      .filter((image): image is string => image !== null),
    mood: moment.mood,
    location: moment.location,
    createdAt: moment.createdAt.toISOString(),
  };
}

/** A project as it appears in an API response. */
export interface ApiProject {
  id: string;
  slug: string;
  name: string;
  summary: string;
  html: string | null;
  url: string;
  repoUrl: string | null;
  liveUrl: string | null;
  embedUrl: string | null;
  coverUrl: string | null;
  techStack: string[];
  featured: boolean;
}

/** Serialises a project. */
export function serializeProject(
  project: ProjectView,
  locale: AppLocale,
): ApiProject {
  return {
    id: project.id,
    slug: project.slug,
    name: project.name,
    summary: project.summary,
    html: project.bodyHtml,
    url: `${env.NEXT_PUBLIC_SITE_URL}/${locale}/projects/${project.slug}`,
    repoUrl: project.repoUrl,
    liveUrl: project.liveUrl,
    embedUrl: project.embedUrl,
    coverUrl: absoluteUrl(project.coverUrl),
    techStack: project.techStack,
    featured: project.featured,
  };
}
