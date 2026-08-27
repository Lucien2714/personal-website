import type {Metadata} from 'next';
import {redirect} from 'next/navigation';
import {getTranslations, setRequestLocale} from 'next-intl/server';

import {LoginForm} from '@/app/[locale]/admin/login/LoginForm';
import {Container} from '@/components/ui/primitives';
import type {AppLocale} from '@/i18n/routing';
import {isStaffRole} from '@/lib/auth/guard';
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
  // Only a *staff* session is a reason to leave: the console guard admits
  // nothing less, so redirecting a signed-in reader here would bounce them
  // straight back and loop forever. A reader who lands on this page is shown
  // the form instead — signing in as staff replaces their session, which is
  // exactly what someone reaching the console login intends.
  const user = await getSessionUser();
  if (user && isStaffRole(user.role)) {
    redirect(`/${locale}/admin`);
  }

  const t = await getTranslations('auth');

  return (
    <Container size="narrow" className="py-24">
      <div className="card mx-auto max-w-sm p-7">
        <div className="mb-6 text-center">
          <span
            aria-hidden="true"
            className="mx-auto mb-4 block h-0.5 w-8 rounded-full bg-[var(--color-accent)]"
          />
          <h1 className="font-display text-2xl font-bold">
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
