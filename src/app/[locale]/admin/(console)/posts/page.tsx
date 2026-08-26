import {getTranslations, setRequestLocale} from 'next-intl/server';

import {FormattedDate} from '@/components/ui/FormattedDate';
import {Chip} from '@/components/ui/primitives';
import {Link} from '@/i18n/navigation';
import {type AppLocale, localeLabels, toAppLocale} from '@/i18n/routing';
import {statusMessageKey, statusTone} from '@/lib/admin/status';
import {db} from '@/lib/db';

/**
 * The post list.
 *
 * Shows drafts and scheduled posts alongside published ones - the console's
 * job is to show what exists, not what is public.
 */

export const dynamic = 'force-dynamic';

/** Renders every post that has not been deleted. */
export default async function AdminPostsPage({
  params,
}: {
  params: Promise<{locale: AppLocale}>;
}) {
  const {locale} = await params;
  setRequestLocale(locale);

  const [t, posts] = await Promise.all([
    getTranslations('admin'),
    db.post.findMany({
      where: {deletedAt: null},
      orderBy: [{updatedAt: 'desc'}],
      select: {
        id: true,
        status: true,
        pinned: true,
        publishedAt: true,
        updatedAt: true,
        viewCount: true,
        translations: {select: {locale: true, title: true, slug: true}},
      },
    }),
  ]);

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-4">
        <h2 className="font-display text-xl font-bold">{t('posts')}</h2>
        <Link
          href="/admin/posts/new"
          className="rounded-full bg-[var(--color-sakura)] px-4 py-2 text-sm font-semibold text-white transition hover:opacity-90"
        >
          + {t('newPost')}
        </Link>
      </div>

      {posts.length === 0 ? (
        <p className="card p-8 text-center text-sm text-[var(--color-ink-muted)]">
          {t('empty')}
        </p>
      ) : (
        <ul className="card divide-y divide-[var(--color-border)]">
          {posts.map((post) => {
            const primary = post.translations[0];

            return (
              <li key={post.id}>
                <Link
                  href={`/admin/posts/${post.id}`}
                  className="flex flex-wrap items-center gap-x-3 gap-y-2 p-4 transition hover:bg-[var(--color-surface-sunken)]"
                >
                  <Chip tone={statusTone(post.status)}>
                    {t(statusMessageKey(post.status))}
                  </Chip>

                  {post.pinned && <Chip tone="lavender">📌</Chip>}

                  <span className="min-w-0 flex-1 truncate text-sm font-medium">
                    {primary?.title ?? '(untitled)'}
                  </span>

                  <span className="flex items-center gap-1">
                    {post.translations.map((translation) => (
                      <span
                        key={translation.locale}
                        className="rounded-md bg-[var(--color-surface-sunken)] px-1.5 py-0.5 text-[0.65rem] font-semibold uppercase text-[var(--color-ink-subtle)]"
                      >
                        {localeLabels[toAppLocale(translation.locale)]}
                      </span>
                    ))}
                  </span>

                  <span className="w-16 text-right text-xs tabular-nums text-[var(--color-ink-subtle)]">
                    👀 {post.viewCount}
                  </span>

                  <FormattedDate
                    value={post.publishedAt ?? post.updatedAt}
                    variant="short"
                    className="w-24 text-right text-xs text-[var(--color-ink-subtle)]"
                  />
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
