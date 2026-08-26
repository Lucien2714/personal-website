import {getTranslations, setRequestLocale} from 'next-intl/server';

import {FormattedDate} from '@/components/ui/FormattedDate';
import {Chip} from '@/components/ui/primitives';
import {Link} from '@/i18n/navigation';
import type {AppLocale} from '@/i18n/routing';
import {statusMessageKey, statusTone} from '@/lib/admin/status';
import {db} from '@/lib/db';

/**
 * The console dashboard.
 *
 * Counts and the last few edits, so that opening the console answers "where
 * did I leave off?" before anything else.
 */

export const dynamic = 'force-dynamic';

/** Collects the dashboard counters in a single round trip. */
async function loadStats() {
  const [posts, drafts, moments, projects, media, views] = await Promise.all([
    db.post.count({where: {deletedAt: null, status: 'PUBLISHED'}}),
    db.post.count({where: {deletedAt: null, status: 'DRAFT'}}),
    db.moment.count({where: {deletedAt: null}}),
    db.project.count(),
    db.media.count(),
    db.post.aggregate({_sum: {viewCount: true}}),
  ]);

  return {
    posts,
    drafts,
    moments,
    projects,
    media,
    views: views._sum.viewCount ?? 0,
  };
}

/** Renders the dashboard. */
export default async function DashboardPage({
  params,
}: {
  params: Promise<{locale: AppLocale}>;
}) {
  const {locale} = await params;
  setRequestLocale(locale);

  const [t, stats, recent] = await Promise.all([
    getTranslations('admin'),
    loadStats(),
    db.post.findMany({
      where: {deletedAt: null},
      orderBy: {updatedAt: 'desc'},
      take: 5,
      select: {
        id: true,
        status: true,
        updatedAt: true,
        translations: {select: {locale: true, title: true}},
      },
    }),
  ]);

  const tiles = [
    {label: t('stats.posts'), value: stats.posts, icon: '📝'},
    {label: t('stats.drafts'), value: stats.drafts, icon: '✏️'},
    {label: t('stats.moments'), value: stats.moments, icon: '🌙'},
    {label: t('stats.projects'), value: stats.projects, icon: '🛠'},
    {label: t('stats.media'), value: stats.media, icon: '🖼'},
    {label: t('stats.views'), value: stats.views, icon: '👀'},
  ];

  return (
    <div className="space-y-8">
      <section>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {tiles.map((tile) => (
            <div key={tile.label} className="card p-4">
              <div className="flex items-center gap-2 text-xs text-[var(--color-ink-subtle)]">
                <span aria-hidden="true">{tile.icon}</span>
                {tile.label}
              </div>
              <p className="mt-1.5 font-display text-2xl font-bold tabular-nums">
                {tile.value}
              </p>
            </div>
          ))}
        </div>
      </section>

      <section>
        <div className="mb-4 flex flex-wrap gap-3">
          <Link
            href="/admin/posts/new"
            className="rounded-lg bg-[var(--color-accent)] px-4 py-2 text-sm font-semibold text-[var(--color-on-accent)] transition hover:opacity-90"
          >
            + {t('newPost')}
          </Link>
          <Link
            href="/admin/moments"
            className="rounded-lg border border-[var(--color-border)] px-4 py-2 text-sm font-semibold transition hover:border-[var(--color-accent)] hover:text-[var(--color-accent)]"
          >
            + {t('newMoment')}
          </Link>
        </div>

        <div className="card divide-y divide-[var(--color-border)]">
          {recent.length === 0 ? (
            <p className="p-5 text-sm text-[var(--color-ink-muted)]">
              {t('empty')}
            </p>
          ) : (
            recent.map((post) => {
              const title = post.translations[0]?.title ?? '(untitled)';
              return (
                <Link
                  key={post.id}
                  href={`/admin/posts/${post.id}`}
                  className="flex flex-wrap items-center gap-3 p-4 transition hover:bg-[var(--color-surface-sunken)]"
                >
                  <Chip tone={statusTone(post.status)}>
                    {t(statusMessageKey(post.status))}
                  </Chip>
                  <span className="min-w-0 flex-1 truncate text-sm font-medium">
                    {title}
                  </span>
                  <FormattedDate
                    value={post.updatedAt}
                    variant="short"
                    className="text-xs text-[var(--color-ink-subtle)]"
                  />
                </Link>
              );
            })
          )}
        </div>
      </section>
    </div>
  );
}
