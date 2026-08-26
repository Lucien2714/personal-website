'use client';

import {useRouter} from 'next/navigation';
import {useTransition} from 'react';
import {useTranslations} from 'next-intl';

/**
 * A delete control that confirms first and refreshes the list afterwards.
 *
 * Takes the action as a prop rather than importing one, so the same button
 * serves moments, projects, media and API keys instead of each list growing
 * its own near-identical copy.
 */
export function DeleteButton({
  id,
  action,
  label,
  className,
}: {
  id: string;
  /** Server action that removes the record. */
  action: (id: string) => Promise<{ok: boolean}>;
  /** Optional label; defaults to the translated "Delete". */
  label?: string;
  className?: string;
}) {
  const t = useTranslations('admin');
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const handleClick = () => {
    if (!window.confirm(t('confirmDelete'))) {
      return;
    }

    startTransition(async () => {
      const result = await action(id);
      if (result.ok) {
        router.refresh();
      }
    });
  };

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={isPending}
      className={
        className ??
        'rounded-full border border-[var(--color-border)] px-3 py-1 text-xs font-medium text-[var(--color-ink-muted)] transition hover:border-[var(--color-danger)] hover:text-[var(--color-danger)] disabled:opacity-50'
      }
    >
      {label ?? t('delete')}
    </button>
  );
}
