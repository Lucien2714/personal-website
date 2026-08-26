import type {Metadata} from 'next';
import {getTranslations, setRequestLocale} from 'next-intl/server';

import {PostCard} from '@/components/post/PostCard';
import {Pagination} from '@/components/ui/Pagination';
import {
  Chip,
  Container,
  EmptyState,
  PageHeader,
} from '@/components/ui/primitives';
import {Link} from '@/i18n/navigation';
import {type AppLocale, toPrismaLocale} from '@/i18n/routing';
import {listCategories, listPosts, listTags} from '@/lib/content/posts';

/**
 * The post index.
 *
 * Filters (category, tag, free-text search) and the page number live in the
 * query string rather than in the path, which keeps one route responsible for
 * every combination and makes each combination linkable.
 */

/** Content changes whenever the author publishes, so never serve a snapshot. */
export const dynamic = 'force-dynamic';

/** Query parameters this page understands. */
interface PostsSearchParams {
  page?: string;
  category?: string;
  tag?: string;
  q?: string;
}

/** Builds the page metadata for the active locale. */
export async function generateMetadata({
  params,
}: {
  params: Promise<{locale: AppLocale}>;
}): Promise<Metadata> {
  const {locale} = await params;
  const t = await getTranslations({locale, namespace: 'posts'});
  return {title: t('title'), description: t('subtitle')};
}

/** Renders a page of posts. */
export default async function PostsPage({
  params,
  searchParams,
}: {
  params: Promise<{locale: AppLocale}>;
  searchParams: Promise<PostsSearchParams>;
}) {
  const [{locale}, query] = await Promise.all([params, searchParams]);
  setRequestLocale(locale);

  const prismaLocale = toPrismaLocale(locale);
  const page = Number.parseInt(query.page ?? '1', 10) || 1;

  const [t, tCategories, tTags, result, categories, tags] = await Promise.all([
    getTranslations('posts'),
    getTranslations('categories'),
    getTranslations('tags'),
    listPosts({
      locale: prismaLocale,
      page,
      categorySlug: query.category,
      tagSlug: query.tag,
      query: query.q,
    }),
    listCategories(prismaLocale),
    listTags(prismaLocale),
  ]);

  const activeCategory = categories.find(
    (category) => category.slug === query.category,
  );
  const activeTag = tags.find((tag) => tag.slug === query.tag);
  const hasFilter = Boolean(activeCategory ?? activeTag ?? query.q);

  return (
    <Container size="wide" className="pb-16">
      <PageHeader title={t('title')} subtitle={t('subtitle')} decoration="📖" />

      {hasFilter && (
        <div className="mb-6 flex flex-wrap items-center gap-3">
          {activeCategory && (
            <Chip tone="sky">
              {t('filteredByCategory', {name: activeCategory.name})}
            </Chip>
          )}
          {activeTag && (
            <Chip tone="lavender">
              {t('filteredByTag', {name: activeTag.name})}
            </Chip>
          )}
          <Link
            href="/posts"
            className="text-sm text-[var(--color-sakura)] underline-offset-4 hover:underline"
          >
            {t('clearFilter')}
          </Link>
        </div>
      )}

      <div className="grid gap-8 lg:grid-cols-[1fr_16rem]">
        <div>
          {result.items.length > 0 ? (
            <div className="grid gap-5">
              {result.items.map((post) => (
                <PostCard key={post.id} post={post} />
              ))}
            </div>
          ) : (
            <EmptyState message={t('empty')} />
          )}

          <Pagination
            page={result.page}
            totalPages={result.totalPages}
            basePath="/posts"
            searchParams={{
              category: query.category,
              tag: query.tag,
              q: query.q,
            }}
          />
        </div>

        <aside className="space-y-8 lg:sticky lg:top-24 lg:self-start">
          {categories.length > 0 && (
            <section>
              <h2 className="mb-3 font-display text-sm font-bold uppercase tracking-wide text-[var(--color-ink-subtle)]">
                {tCategories('title')}
              </h2>
              <ul className="flex flex-wrap gap-1.5">
                {categories.map((category) => (
                  <li key={category.slug}>
                    <Link href={`/posts?category=${category.slug}`}>
                      <Chip
                        tone={
                          category.slug === query.category ? 'sakura' : 'sky'
                        }
                      >
                        {category.name}
                        <span className="opacity-60">{category.count}</span>
                      </Chip>
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {tags.length > 0 && (
            <section>
              <h2 className="mb-3 font-display text-sm font-bold uppercase tracking-wide text-[var(--color-ink-subtle)]">
                {tTags('title')}
              </h2>
              <ul className="flex flex-wrap gap-1.5">
                {tags.map((tag) => (
                  <li key={tag.slug}>
                    <Link href={`/posts?tag=${tag.slug}`}>
                      <Chip
                        tone={tag.slug === query.tag ? 'sakura' : 'neutral'}
                      >
                        #{tag.name}
                        <span className="opacity-60">{tag.count}</span>
                      </Chip>
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </aside>
      </div>
    </Container>
  );
}
