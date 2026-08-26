import type {Metadata} from 'next';
import {getTranslations, setRequestLocale} from 'next-intl/server';

import {FormattedDate} from '@/components/ui/FormattedDate';
import {Container, EmptyState, PageHeader} from '@/components/ui/primitives';
import {Link} from '@/i18n/navigation';
import {type AppLocale, toPrismaLocale} from '@/i18n/routing';
import {listArchive} from '@/lib/content/posts';

/** Every post, grouped by year. */

export const dynamic = 'force-dynamic';

/** Builds the page metadata for the active locale. */
export async function generateMetadata({
  params,
}: {
  params: Promise<{locale: AppLocale}>;
}): Promise<Metadata> {
  const {locale} = await params;
  const t = await getTranslations({locale, namespace: 'archives'});
  return {title: t('title'), description: t('subtitle')};
}

/** Renders the archive. */
export default async function ArchivesPage({
  params,
}: {
  params: Promise<{locale: AppLocale}>;
}) {
  const {locale} = await params;
  setRequestLocale(locale);

  const [t, years] = await Promise.all([
    getTranslations('archives'),
    listArchive(toPrismaLocale(locale)),
  ]);

  return (
    <Container className="pb-16">
      <PageHeader title={t('title')} subtitle={t('subtitle')} />

      {years.length === 0 ? (
        <EmptyState message={t('empty')} />
      ) : (
        <div className="space-y-10">
          {years.map((year) => (
            <section key={year.year}>
              <h2 className="mb-4 flex items-baseline gap-3 font-display text-2xl font-bold">
                {year.year}
                <span className="text-sm font-normal text-[var(--color-ink-subtle)]">
                  {t('postCount', {count: year.posts.length})}
                </span>
              </h2>

              <ul className="space-y-1 border-l-2 border-[var(--color-border)] pl-5">
                {year.posts.map((post) => (
                  <li
                    key={post.slug}
                    className="relative flex flex-wrap items-baseline gap-x-3 py-1.5"
                  >
                    <span
                      aria-hidden="true"
                      className="absolute -left-[1.6rem] top-3 h-2 w-2 rounded-full bg-[var(--color-accent)]"
                    />
                    <FormattedDate
                      value={post.publishedAt}
                      variant="short"
                      className="w-24 shrink-0 text-xs text-[var(--color-ink-subtle)]"
                    />
                    <Link
                      href={`/posts/${post.slug}`}
                      className="font-medium transition hover:text-[var(--color-accent)]"
                    >
                      {post.title}
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}
    </Container>
  );
}
