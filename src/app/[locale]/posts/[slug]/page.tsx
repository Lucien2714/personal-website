import type {Metadata} from 'next';
import Image from 'next/image';
import {notFound} from 'next/navigation';
import {getTranslations, setRequestLocale} from 'next-intl/server';

import {TableOfContents} from '@/components/post/TableOfContents';
import {FormattedDate} from '@/components/ui/FormattedDate';
import {Chip, Container} from '@/components/ui/primitives';
import {Link} from '@/i18n/navigation';
import {type AppLocale, toAppLocale, toPrismaLocale} from '@/i18n/routing';
import {
  getPostBySlug,
  getPostNeighbours,
  recordPostView,
} from '@/lib/content/posts';
import {env} from '@/lib/env';

/**
 * A single post.
 *
 * The body arrives as HTML that this application rendered and sanitised at
 * save time (see src/lib/content/markdown.ts), so the read path is a database
 * fetch and a string interpolation, with no Markdown work per request.
 */

export const dynamic = 'force-dynamic';

/** Builds per-post metadata, including Open Graph and canonical URLs. */
export async function generateMetadata({
  params,
}: {
  params: Promise<{locale: AppLocale; slug: string}>;
}): Promise<Metadata> {
  const {locale, slug} = await params;
  const post = await getPostBySlug(
    decodeURIComponent(slug),
    toPrismaLocale(locale),
  );

  if (!post) {
    return {title: 'Not found'};
  }

  return {
    title: post.title,
    description: post.description ?? undefined,
    alternates: {canonical: `/${locale}/posts/${post.slug}`},
    openGraph: {
      type: 'article',
      title: post.title,
      description: post.description ?? undefined,
      publishedTime: post.publishedAt?.toISOString(),
      modifiedTime: post.updatedAt.toISOString(),
      images: post.coverUrl
        ? [{url: new URL(post.coverUrl, env.NEXT_PUBLIC_SITE_URL).toString()}]
        : undefined,
    },
  };
}

/** Renders one post. */
export default async function PostPage({
  params,
}: {
  params: Promise<{locale: AppLocale; slug: string}>;
}) {
  const {locale, slug} = await params;
  setRequestLocale(locale);

  const prismaLocale = toPrismaLocale(locale);
  const post = await getPostBySlug(decodeURIComponent(slug), prismaLocale);

  if (!post) {
    notFound();
  }

  const [t, neighbours] = await Promise.all([
    getTranslations('post'),
    getPostNeighbours(post.publishedAt, prismaLocale),
  ]);

  // Not awaited: the counter must not delay the response, and a failure to
  // count must not fail the page.
  void recordPostView(post.id);

  return (
    <Container size="wide" className="pb-16">
      <div className="grid gap-10 pt-10 lg:grid-cols-[1fr_15rem] lg:pt-14">
        <article
          // The rendered body may be in a different language from the page
          // shell when a translation is missing.
          lang={toAppLocale(post.locale)}
        >
          <header className="mb-8">
            <h1 className="font-display text-3xl font-bold leading-tight sm:text-4xl">
              {post.title}
            </h1>

            <div className="mt-4 flex flex-wrap items-center gap-x-3 gap-y-2 text-sm text-[var(--color-ink-subtle)]">
              {post.publishedAt && (
                <span className="inline-flex items-center gap-1.5">
                  <span aria-hidden="true">🗓</span>
                  <FormattedDate value={post.publishedAt} />
                </span>
              )}
              <span aria-hidden="true">·</span>
              <span>{t('readingTime', {minutes: post.readingMinutes})}</span>
              <span aria-hidden="true">·</span>
              <span>{t('views', {count: post.viewCount})}</span>
            </div>

            {(post.categories.length > 0 || post.tags.length > 0) && (
              <div className="mt-4 flex flex-wrap gap-1.5">
                {post.categories.map((category) => (
                  <Link
                    key={category.slug}
                    href={`/posts?category=${category.slug}`}
                  >
                    <Chip tone="sky">{category.name}</Chip>
                  </Link>
                ))}
                {post.tags.map((tag) => (
                  <Link key={tag.slug} href={`/posts?tag=${tag.slug}`}>
                    <Chip tone="neutral">#{tag.name}</Chip>
                  </Link>
                ))}
              </div>
            )}

            {post.isFallback && (
              <p className="mt-5 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-sunken)] px-4 py-3 text-sm text-[var(--color-ink-muted)]">
                {t('notAvailableInLocale')}
              </p>
            )}
          </header>

          {post.coverUrl && (
            <div className="relative mb-8 aspect-[2/1] w-full overflow-hidden rounded-2xl">
              <Image
                src={post.coverUrl}
                alt=""
                fill
                sizes="(max-width: 1024px) 100vw, 760px"
                className="object-cover"
                priority
              />
            </div>
          )}

          {/* The HTML was sanitised by rehype-sanitize before it was stored;
              see src/lib/content/markdown.ts for the schema in force. */}
          <div
            className="prose-anime"
            dangerouslySetInnerHTML={{__html: post.bodyHtml}}
          />

          <nav className="mt-14 grid gap-3 border-t border-[var(--color-border)] pt-6 sm:grid-cols-2">
            {neighbours.previous ? (
              <Link
                href={`/posts/${neighbours.previous.slug}`}
                className="card card-interactive p-4"
                rel="prev"
              >
                <span className="text-xs text-[var(--color-ink-subtle)]">
                  ← {t('previous')}
                </span>
                <span className="mt-1 block font-medium">
                  {neighbours.previous.title}
                </span>
              </Link>
            ) : (
              <span />
            )}

            {neighbours.next && (
              <Link
                href={`/posts/${neighbours.next.slug}`}
                className="card card-interactive p-4 sm:text-right"
                rel="next"
              >
                <span className="text-xs text-[var(--color-ink-subtle)]">
                  {t('next')} →
                </span>
                <span className="mt-1 block font-medium">
                  {neighbours.next.title}
                </span>
              </Link>
            )}
          </nav>
        </article>

        <aside className="hidden lg:sticky lg:top-24 lg:block lg:self-start">
          <TableOfContents entries={post.toc} />

          <Link
            href="/posts"
            className="mt-8 inline-block text-sm text-[var(--color-sakura)] underline-offset-4 hover:underline"
          >
            ← {t('backToPosts')}
          </Link>
        </aside>
      </div>
    </Container>
  );
}
