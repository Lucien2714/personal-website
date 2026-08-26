import {getTranslations, setRequestLocale} from 'next-intl/server';
import type {ReactNode} from 'react';

import {signOutAction} from '@/app/[locale]/admin/login/actions';
import {AdminNav} from '@/components/admin/AdminNav';
import {Link} from '@/i18n/navigation';
import type {AppLocale} from '@/i18n/routing';
import {requireUser} from '@/lib/auth/guard';

/**
 * The console shell.
 *
 * Everything under `admin/(console)` is behind this layout, and the layout
 * starts by requiring a session. The login page sits outside the route group
 * on purpose: putting it inside would make signing in require being signed in.
 */

export const dynamic = 'force-dynamic';

/** Renders the console chrome around an admin page. */
export default async function ConsoleLayout({
  children,
  params,
}: {
  children: ReactNode;
  params: Promise<{locale: AppLocale}>;
}) {
  const {locale} = await params;
  setRequestLocale(locale);

  const [user, t, tAuth] = await Promise.all([
    requireUser(locale, `/${locale}/admin`),
    getTranslations('admin'),
    getTranslations('auth'),
  ]);

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-8">
      <header className="mb-8 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-bold">
            <span aria-hidden="true" className="mr-2">
              ⚙
            </span>
            {t('title')}
          </h1>
          <p className="mt-1 text-sm text-[var(--color-ink-subtle)]">
            {user.displayName} · {user.email}
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Link
            href="/"
            className="rounded-lg border border-[var(--color-border)] px-4 py-2 text-sm font-medium transition hover:border-[var(--color-accent)] hover:text-[var(--color-accent)]"
          >
            {t('backToSite')}
          </Link>

          <form action={signOutAction}>
            <input type="hidden" name="locale" value={locale} />
            <button
              type="submit"
              className="rounded-lg border border-[var(--color-border)] px-4 py-2 text-sm font-medium text-[var(--color-ink-muted)] transition hover:border-[var(--color-danger)] hover:text-[var(--color-danger)]"
            >
              {tAuth('signOut')}
            </button>
          </form>
        </div>
      </header>

      <div className="grid gap-8 lg:grid-cols-[13rem_1fr]">
        <AdminNav />
        <div className="min-w-0">{children}</div>
      </div>
    </div>
  );
}
