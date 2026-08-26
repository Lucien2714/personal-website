import type {Metadata} from 'next';
import {redirect} from 'next/navigation';
import {getTranslations, setRequestLocale} from 'next-intl/server';

import {LoginForm} from '@/app/[locale]/admin/login/LoginForm';
import {Container} from '@/components/ui/primitives';
import type {AppLocale} from '@/i18n/routing';
import {getSessionUser} from '@/lib/auth/session';

/** The console sign-in page. */

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Sign in',
  // Keeps the login page out of search results.
  robots: {index: false, follow: false},
};

/** Renders the sign-in page. */
export default async function LoginPage({
  params,
  searchParams,
}: {
  params: Promise<{locale: AppLocale}>;
  searchParams: Promise<{next?: string}>;
}) {
  const [{locale}, query] = await Promise.all([params, searchParams]);
  setRequestLocale(locale);

  // Someone who is already signed in has no business on the login page.
  const user = await getSessionUser();
  if (user) {
    redirect(`/${locale}/admin`);
  }

  const t = await getTranslations('auth');

  return (
    <Container size="narrow" className="py-24">
      <div className="card mx-auto max-w-sm p-7">
        <div className="mb-6 text-center">
          <span aria-hidden="true" className="text-3xl">
            🌸
          </span>
          <h1 className="mt-2 font-display text-2xl font-bold">
            {t('signInTitle')}
          </h1>
          <p className="mt-1 text-sm text-[var(--color-ink-muted)]">
            {t('signInSubtitle')}
          </p>
        </div>

        <LoginForm locale={locale} next={query.next} />
      </div>
    </Container>
  );
}
