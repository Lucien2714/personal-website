import {getTranslations} from 'next-intl/server';

import {Link} from '@/i18n/navigation';
import {cn} from '@/lib/utils/cn';

/**
 * Previous/next pagination for index pages.
 *
 * Implemented with real links rather than buttons so that a page of results is
 * addressable, shareable and reachable without JavaScript.
 */
export async function Pagination({
  page,
  totalPages,
  /** Locale-agnostic base path, for example `/posts`. */
  basePath,
  /** Query parameters to preserve across pages, such as an active filter. */
  searchParams = {},
}: {
  page: number;
  totalPages: number;
  basePath: string;
  searchParams?: Record<string, string | undefined>;
}) {
  const t = await getTranslations('posts');

  if (totalPages <= 1) {
    return null;
  }

  /** Builds the href for a page number, keeping existing filters intact. */
  const hrefFor = (targetPage: number) => {
    const query = new URLSearchParams();
    for (const [key, value] of Object.entries(searchParams)) {
      if (value !== undefined && value !== '') {
        query.set(key, value);
      }
    }
    if (targetPage > 1) {
      query.set('page', String(targetPage));
    }
    const suffix = query.toString();
    return suffix ? `${basePath}?${suffix}` : basePath;
  };

  const linkClass = cn(
    'inline-flex items-center gap-1.5 rounded-full border px-4 py-2 text-sm font-medium',
    'border-[var(--color-border)] bg-[var(--color-surface)]',
    'text-[var(--color-ink-muted)] transition',
    'hover:border-[var(--color-sakura)] hover:text-[var(--color-sakura)]',
  );

  return (
    <nav
      className="mt-10 flex items-center justify-between gap-4"
      aria-label={t('page', {current: page, total: totalPages})}
    >
      {page > 1 ? (
        <Link href={hrefFor(page - 1)} className={linkClass} rel="prev">
          <span aria-hidden="true">←</span>
          {t('newer')}
        </Link>
      ) : (
        <span />
      )}

      <span className="text-sm text-[var(--color-ink-subtle)]">
        {t('page', {current: page, total: totalPages})}
      </span>

      {page < totalPages ? (
        <Link href={hrefFor(page + 1)} className={linkClass} rel="next">
          {t('older')}
          <span aria-hidden="true">→</span>
        </Link>
      ) : (
        <span />
      )}
    </nav>
  );
}
