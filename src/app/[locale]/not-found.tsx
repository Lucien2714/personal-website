import {useTranslations} from 'next-intl';

import {Container} from '@/components/ui/primitives';
import {Link} from '@/i18n/navigation';

/** Shown when a route inside a locale segment matches nothing. */
export default function LocaleNotFound() {
  const t = useTranslations('error');

  return (
    <Container className="flex flex-col items-center gap-6 py-24 text-center">
      <span
        aria-hidden="true"
        className="animate-drift font-display text-6xl font-bold text-[var(--color-accent)]"
      >
        404
      </span>

      <div className="space-y-2">
        <h1 className="font-display text-3xl font-bold">
          {t('notFoundTitle')}
        </h1>
        <p className="text-[var(--color-ink-muted)]">{t('notFoundBody')}</p>
      </div>

      <Link
        href="/"
        className="rounded-lg bg-[var(--color-accent)] px-5 py-2 text-sm font-semibold text-[var(--color-on-accent)] transition hover:opacity-90"
      >
        {t('goHome')}
      </Link>
    </Container>
  );
}
