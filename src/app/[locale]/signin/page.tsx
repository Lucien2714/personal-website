import type {Metadata} from 'next';
import {getTranslations, setRequestLocale} from 'next-intl/server';

import {readerSignOutAction} from '@/app/[locale]/signin/actions';
import {Container} from '@/components/ui/primitives';
import {Link} from '@/i18n/navigation';
import type {AppLocale} from '@/i18n/routing';
import {configuredProviders} from '@/lib/auth/oauth/providers';
import {safeReturnPath} from '@/lib/auth/oauth/state';
import {getSessionUser} from '@/lib/auth/session';

/**
 * Reader sign-in.
 *
 * Offers exactly the providers this deployment has credentials for, so an
 * unconfigured one is never presented and can never fail halfway through the
 * redirect.
 */

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Sign in',
  // Nothing here belongs in a search result.
  robots: {index: false, follow: false},
};

/** Error codes the OAuth callback can hand back. */
const KNOWN_ERRORS = [
  'cancelled',
  'invalid_state',
  'missing_code',
  'unknown_provider',
  'provider_error',
] as const;

/** Renders the sign-in options, or the current account when already signed in. */
export default async function SignInPage({
  params,
  searchParams,
}: {
  params: Promise<{locale: AppLocale}>;
  searchParams: Promise<{next?: string; signin_error?: string}>;
}) {
  const [{locale}, query] = await Promise.all([params, searchParams]);
  setRequestLocale(locale);

  const [t, tError, viewer] = await Promise.all([
    getTranslations('signin'),
    getTranslations('error'),
    getSessionUser(),
  ]);

  const providers = configuredProviders();
  const returnTo = safeReturnPath(query.next ?? null, `/${locale}`);

  const errorCode = KNOWN_ERRORS.find((code) => code === query.signin_error);

  return (
    <Container size="narrow" className="py-20">
      <div className="card mx-auto max-w-sm p-7">
        <div className="mb-6 text-center">
          <span
            aria-hidden="true"
            className="mx-auto mb-4 block h-0.5 w-8 rounded-full bg-[var(--color-accent)]"
          />
          <h1 className="font-display text-2xl font-bold">{t('title')}</h1>
          <p className="mt-2 text-sm text-[var(--color-ink-muted)]">
            {t('subtitle')}
          </p>
        </div>

        {errorCode && (
          <p
            role="alert"
            className="mb-4 rounded-lg bg-[var(--color-accent-soft)] px-3.5 py-2.5 text-sm text-[var(--color-danger)]"
          >
            {t(`error.${errorCode}`)}
          </p>
        )}

        {viewer ? (
          <div className="space-y-4 text-center">
            <p className="text-sm">
              {t('signedInAs', {name: viewer.displayName})}
            </p>

            <form action={readerSignOutAction} className="space-y-3">
              <input type="hidden" name="locale" value={locale} />
              <input type="hidden" name="next" value={returnTo} />
              <button
                type="submit"
                className="w-full rounded-lg border border-[var(--color-border)] px-5 py-2.5 text-sm font-semibold transition hover:border-[var(--color-danger)] hover:text-[var(--color-danger)]"
              >
                {t('signOut')}
              </button>
            </form>

            <Link
              href="/"
              className="inline-block text-sm text-[var(--color-accent)] underline-offset-4 hover:underline"
            >
              ← {tError('goHome')}
            </Link>
          </div>
        ) : providers.length === 0 ? (
          <p className="text-center text-sm text-[var(--color-ink-muted)]">
            {t('noProviders')}
          </p>
        ) : (
          <ul className="space-y-2.5">
            {providers.map((provider) => (
              <li key={provider.slug}>
                {/* A plain link, not next/link: this leaves the application
                    for the provider, and prefetching it would start a
                    sign-in nobody asked for. */}
                <a
                  href={`/api/auth/${provider.slug}?next=${encodeURIComponent(returnTo)}`}
                  className="flex w-full items-center justify-center gap-2 rounded-lg border border-[var(--color-border)] px-5 py-2.5 text-sm font-semibold transition hover:border-[var(--color-accent)] hover:text-[var(--color-accent)]"
                >
                  {t('continueWith', {provider: provider.label})}
                </a>
              </li>
            ))}
          </ul>
        )}
      </div>
    </Container>
  );
}
