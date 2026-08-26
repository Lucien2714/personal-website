'use client';

import {useParams} from 'next/navigation';
import {useTransition} from 'react';

import {usePathname, useRouter} from '@/i18n/navigation';
import {type AppLocale, localeLabels, locales} from '@/i18n/routing';
import {cn} from '@/lib/utils/cn';

/**
 * Switches the interface language while keeping the reader where they are.
 *
 * The current pathname is locale-stripped by `usePathname` from
 * `@/i18n/navigation`, so replacing the locale is a matter of re-rendering the
 * same route under a different prefix. Dynamic segments are carried across via
 * `useParams`, which is what keeps `/en/posts/hello` from collapsing to
 * `/zh/posts` on switch.
 */
export function LocaleSwitcher({className}: {className?: string}) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useParams();
  const [isPending, startTransition] = useTransition();

  const activeLocale = (params.locale as AppLocale | undefined) ?? locales[0];

  const switchTo = (locale: AppLocale) => {
    if (locale === activeLocale) {
      return;
    }
    startTransition(() => {
      // `usePathname` from `@/i18n/navigation` returns the path with the
      // locale prefix already stripped and dynamic segments already filled
      // in, so re-rendering it under a different locale is all that is needed.
      router.replace(pathname, {locale});
    });
  };

  return (
    <div
      className={cn(
        'inline-flex items-center rounded-full border',
        'border-[var(--color-border)] bg-[var(--color-surface)] p-0.5',
        isPending && 'opacity-60',
        className,
      )}
      role="group"
      aria-label="Language"
    >
      {locales.map((locale) => (
        <button
          key={locale}
          type="button"
          onClick={() => switchTo(locale)}
          aria-current={locale === activeLocale ? 'true' : undefined}
          className={cn(
            'rounded-full px-2.5 py-1 text-xs font-semibold transition',
            locale === activeLocale
              ? 'bg-[var(--color-sakura)] text-white'
              : 'text-[var(--color-ink-muted)] hover:text-[var(--color-sakura)]',
          )}
        >
          {localeLabels[locale]}
        </button>
      ))}
    </div>
  );
}
