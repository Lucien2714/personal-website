import {getTranslations} from 'next-intl/server';

import {readerSignOutAction} from '@/app/[locale]/signin/actions';
import {Link} from '@/i18n/navigation';
import type {AppLocale} from '@/i18n/routing';
import {isStaffRole} from '@/lib/auth/guard';
import {getSessionUser} from '@/lib/auth/session';

/**
 * The account area in the site header.
 *
 * A server component, so the session never has to be exposed to the client
 * just to decide which of two links to draw. Staff additionally get a link to
 * the console, which is otherwise reachable only by typing its URL.
 */

/** Renders the sign-in link, or the current account. */
export async function AccountMenu({
  locale,
  /** Path the sign-in should return to. */
  returnTo,
}: {
  locale: AppLocale;
  returnTo: string;
}) {
  const [t, tAdmin, viewer] = await Promise.all([
    getTranslations('signin'),
    getTranslations('admin'),
    getSessionUser(),
  ]);

  if (!viewer) {
    return (
      <Link
        href={`/signin?next=${encodeURIComponent(returnTo)}`}
        className="rounded-lg border border-[var(--color-border)] px-3 py-1.5 text-xs font-semibold text-[var(--color-ink-muted)] transition hover:border-[var(--color-accent)] hover:text-[var(--color-accent)]"
      >
        {t('title')}
      </Link>
    );
  }

  return (
    <div className="flex items-center gap-2">
      {isStaffRole(viewer.role) && (
        <Link
          href="/admin"
          className="rounded-lg border border-[var(--color-border)] px-3 py-1.5 text-xs font-semibold text-[var(--color-ink-muted)] transition hover:border-[var(--color-accent)] hover:text-[var(--color-accent)]"
        >
          {tAdmin('title')}
        </Link>
      )}

      <form action={readerSignOutAction}>
        <input type="hidden" name="locale" value={locale} />
        <input type="hidden" name="next" value={returnTo} />
        <button
          type="submit"
          title={t('signedInAs', {name: viewer.displayName})}
          className="flex items-center gap-1.5 rounded-lg border border-[var(--color-border)] px-2 py-1 text-xs font-medium text-[var(--color-ink-muted)] transition hover:border-[var(--color-danger)] hover:text-[var(--color-danger)]"
        >
          <span className="h-5 w-5 overflow-hidden rounded bg-[var(--color-surface-sunken)]">
            {viewer.avatarUrl && (
              // A third-party URL: see the note in CommentItem for why this is
              // not routed through the image optimiser.
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={viewer.avatarUrl}
                alt=""
                width={20}
                height={20}
                loading="lazy"
                decoding="async"
                referrerPolicy="no-referrer"
                className="h-full w-full object-cover"
              />
            )}
          </span>
          <span className="hidden max-w-24 truncate sm:inline">
            {viewer.displayName}
          </span>
        </button>
      </form>
    </div>
  );
}
