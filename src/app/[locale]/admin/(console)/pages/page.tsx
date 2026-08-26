import {getTranslations, setRequestLocale} from 'next-intl/server';

import {Chip} from '@/components/ui/primitives';
import {Link} from '@/i18n/navigation';
import type {AppLocale} from '@/i18n/routing';
import {statusMessageKey, statusTone} from '@/lib/admin/status';
import {db} from '@/lib/db';

/** The standalone-pages list. */

export const dynamic = 'force-dynamic';

/** Renders every standalone page. */
export default async function AdminPagesPage({
  params,
}: {
  params: Promise<{locale: AppLocale}>;
}) {
  const {locale} = await params;
  setRequestLocale(locale);

  const [t, pages] = await Promise.all([
    getTranslations('admin'),
    db.page.findMany({
      orderBy: [{navOrder: 'asc'}, {slug: 'asc'}],
      select: {
        slug: true,
        status: true,
        navOrder: true,
        translations: {select: {title: true}},
      },
    }),
  ]);

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-4">
        <h2 className="font-display text-xl font-bold">{t('pages')}</h2>
        <Link
          href="/admin/pages/new"
          className="rounded-full bg-[var(--color-sakura)] px-4 py-2 text-sm font-semibold text-white transition hover:opacity-90"
        >
          + {t('pages')}
        </Link>
      </div>

      {pages.length === 0 ? (
        <p className="card p-8 text-center text-sm text-[var(--color-ink-muted)]">
          {t('empty')}
        </p>
      ) : (
        <ul className="card divide-y divide-[var(--color-border)]">
          {pages.map((page) => (
            <li key={page.slug}>
              <Link
                href={`/admin/pages/${page.slug}`}
                className="flex flex-wrap items-center gap-x-3 gap-y-2 p-4 transition hover:bg-[var(--color-surface-sunken)]"
              >
                <Chip tone={statusTone(page.status)}>
                  {t(statusMessageKey(page.status))}
                </Chip>

                <span className="min-w-0 flex-1 truncate text-sm font-medium">
                  {page.translations[0]?.title ?? page.slug}
                </span>

                {page.navOrder !== null && (
                  <Chip tone="sky">nav {page.navOrder}</Chip>
                )}

                <code className="font-mono text-xs text-[var(--color-ink-subtle)]">
                  /{page.slug}
                </code>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
