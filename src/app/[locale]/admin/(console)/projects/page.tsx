import {getTranslations, setRequestLocale} from 'next-intl/server';

import {Chip} from '@/components/ui/primitives';
import {Link} from '@/i18n/navigation';
import type {AppLocale} from '@/i18n/routing';
import {statusMessageKey, statusTone} from '@/lib/admin/status';
import {db} from '@/lib/db';

/** The projects list. */

export const dynamic = 'force-dynamic';

/** Renders every project. */
export default async function AdminProjectsPage({
  params,
}: {
  params: Promise<{locale: AppLocale}>;
}) {
  const {locale} = await params;
  setRequestLocale(locale);

  const [t, projects] = await Promise.all([
    getTranslations('admin'),
    db.project.findMany({
      orderBy: [{featured: 'desc'}, {sortOrder: 'asc'}, {createdAt: 'desc'}],
      select: {
        id: true,
        slug: true,
        status: true,
        featured: true,
        embedUrl: true,
        translations: {select: {name: true}},
      },
    }),
  ]);

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-4">
        <h2 className="font-display text-xl font-bold">{t('projects')}</h2>
        <Link
          href="/admin/projects/new"
          className="rounded-lg bg-[var(--color-accent)] px-4 py-2 text-sm font-semibold text-[var(--color-on-accent)] transition hover:opacity-90"
        >
          + {t('newProject')}
        </Link>
      </div>

      {projects.length === 0 ? (
        <p className="card p-8 text-center text-sm text-[var(--color-ink-muted)]">
          {t('empty')}
        </p>
      ) : (
        <ul className="card divide-y divide-[var(--color-border)]">
          {projects.map((project) => (
            <li key={project.id}>
              <Link
                href={`/admin/projects/${project.id}`}
                className="flex flex-wrap items-center gap-x-3 gap-y-2 p-4 transition hover:bg-[var(--color-surface-sunken)]"
              >
                <Chip tone={statusTone(project.status)}>
                  {t(statusMessageKey(project.status))}
                </Chip>
                {project.featured && <Chip tone="violet">★</Chip>}
                {project.embedUrl && <Chip tone="cyan">embed</Chip>}

                <span className="min-w-0 flex-1 truncate text-sm font-medium">
                  {project.translations[0]?.name ?? project.slug}
                </span>

                <code className="font-mono text-xs text-[var(--color-ink-subtle)]">
                  {project.slug}
                </code>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
