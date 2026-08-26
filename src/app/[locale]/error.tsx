'use client';

import {useEffect} from 'react';
import {useTranslations} from 'next-intl';

import {Container} from '@/components/ui/primitives';

/**
 * Error boundary for the localised routes.
 *
 * Next.js requires this to be a client component. The `digest` is the only
 * detail shown to the reader: it correlates with the full stack trace in the
 * server logs without leaking any of it to the browser.
 */
export default function LocaleError({
  error,
  reset,
}: {
  error: Error & {digest?: string};
  reset: () => void;
}) {
  const t = useTranslations('error');

  useEffect(() => {
    // Surfaces the failure in the browser console during development and in
    // any client-side error reporting you later add.
    console.error(error);
  }, [error]);

  return (
    <Container className="flex flex-col items-center gap-6 py-24 text-center">
      <span aria-hidden="true" className="text-6xl">
        ⚠️
      </span>

      <div className="space-y-2">
        <h1 className="font-display text-3xl font-bold">{t('genericTitle')}</h1>
        <p className="text-[var(--color-ink-muted)]">{t('genericBody')}</p>
        {error.digest && (
          <p className="font-mono text-xs text-[var(--color-ink-subtle)]">
            {error.digest}
          </p>
        )}
      </div>

      <button
        type="button"
        onClick={reset}
        className="rounded-full bg-[var(--color-sakura)] px-5 py-2 text-sm font-semibold text-white transition hover:opacity-90"
      >
        {t('retry')}
      </button>
    </Container>
  );
}
