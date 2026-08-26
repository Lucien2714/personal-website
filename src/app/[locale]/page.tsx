import Image from 'next/image';
import {getTranslations, setRequestLocale} from 'next-intl/server';

import {MomentCard} from '@/components/moment/MomentCard';
import {PostCard} from '@/components/post/PostCard';
import {ProjectCard} from '@/components/project/ProjectCard';
import {
  Container,
  EmptyState,
  SectionHeading,
} from '@/components/ui/primitives';
import {Link} from '@/i18n/navigation';
import {type AppLocale, toPrismaLocale} from '@/i18n/routing';
import {listRecentMoments} from '@/lib/content/moments';
import {listPosts} from '@/lib/content/posts';
import {listProjects} from '@/lib/content/projects';
import {getSiteSettings} from '@/lib/content/settings';

/**
 * The home page.
 *
 * A hero, then one short section per content type. Each section links onward
 * rather than trying to be the full listing: the page should be readable in a
 * single screenful of scrolling.
 */

/**
 * Rendered per request rather than at build time.
 *
 * The page reads the newest posts, moments and projects; a build-time snapshot
 * would keep showing whatever existed when the image was built until the next
 * deploy, which defeats the point of having a console.
 */
export const dynamic = 'force-dynamic';

/** Renders the home page. */
export default async function HomePage({
  params,
}: {
  params: Promise<{locale: AppLocale}>;
}) {
  const {locale} = await params;
  setRequestLocale(locale);

  const prismaLocale = toPrismaLocale(locale);

  const [t, settings, posts, moments, projects] = await Promise.all([
    getTranslations('home'),
    getSiteSettings(),
    listPosts({locale: prismaLocale, perPage: 4}),
    listRecentMoments(3),
    listProjects(prismaLocale, {featuredOnly: true, limit: 2}),
  ]);

  const headline = settings.heroHeadline[locale] || t('greeting');
  const subline = settings.heroSubline[locale] || t('intro');

  return (
    <Container size="wide" className="pb-16">
      <section className="flex flex-col items-center gap-6 py-14 text-center sm:py-20">
        <span className="relative inline-flex h-24 w-24 overflow-hidden rounded-2xl ring-4 ring-[var(--color-accent-soft)] sm:h-28 sm:w-28">
          <Image
            src={settings.avatarUrl}
            alt={settings.authorName}
            width={112}
            height={112}
            className="h-full w-full object-cover"
            priority
          />
        </span>

        <div className="space-y-3">
          <h1 className="font-display text-3xl font-bold sm:text-5xl">
            {headline}
            <span
              aria-hidden="true"
              className="ml-2 inline-block text-[var(--color-accent)]"
            >
              ▪
            </span>
          </h1>
          <p className="mx-auto max-w-xl text-[var(--color-ink-muted)] sm:text-lg">
            {subline}
          </p>
        </div>
      </section>

      <section className="mb-14">
        <SectionHeading
          title={t('latestPosts')}
          action={
            <Link
              href="/posts"
              className="text-sm font-medium text-[var(--color-accent)] transition hover:text-[var(--color-violet)]"
            >
              {t('viewAll')} →
            </Link>
          }
        />

        {posts.items.length > 0 ? (
          <div className="grid gap-5 sm:grid-cols-2">
            {posts.items.map((post) => (
              <PostCard key={post.id} post={post} />
            ))}
          </div>
        ) : (
          <EmptyState message={t('empty')} />
        )}
      </section>

      {moments.length > 0 && (
        <section className="mb-14">
          <SectionHeading
            title={t('latestMoments')}
            action={
              <Link
                href="/moments"
                className="text-sm font-medium text-[var(--color-accent)] transition hover:text-[var(--color-violet)]"
              >
                {t('viewAll')} →
              </Link>
            }
          />
          <div className="grid gap-4 sm:grid-cols-3">
            {moments.map((moment) => (
              <MomentCard key={moment.id} moment={moment} />
            ))}
          </div>
        </section>
      )}

      {projects.length > 0 && (
        <section>
          <SectionHeading
            title={t('featuredProjects')}
            action={
              <Link
                href="/projects"
                className="text-sm font-medium text-[var(--color-accent)] transition hover:text-[var(--color-violet)]"
              >
                {t('viewAll')} →
              </Link>
            }
          />
          <div className="grid gap-5 sm:grid-cols-2">
            {projects.map((project) => (
              <ProjectCard key={project.id} project={project} />
            ))}
          </div>
        </section>
      )}
    </Container>
  );
}
