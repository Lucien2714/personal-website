'use client';

import {useEffect, useState} from 'react';
import {useTranslations} from 'next-intl';

import {cn} from '@/lib/utils/cn';

/**
 * Copies a short string to the clipboard and confirms that it did.
 *
 * `navigator.clipboard` is unavailable on insecure origins other than
 * localhost, so the failure path selects the text instead of pretending to
 * have copied it.
 */
export function CopyButton({
  value,
  className,
}: {
  value: string;
  className?: string;
}) {
  const t = useTranslations('admin');
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!copied) {
      return;
    }
    const timer = setTimeout(() => setCopied(false), 2000);
    return () => clearTimeout(timer);
  }, [copied]);

  const handleClick = async () => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
    } catch {
      window.prompt(t('copyUrl'), value);
    }
  };

  return (
    <button
      type="button"
      onClick={() => void handleClick()}
      className={cn(
        'rounded-lg border border-[var(--color-border)] px-3 py-1 text-xs font-medium transition hover:border-[var(--color-accent)] hover:text-[var(--color-accent)]',
        className,
      )}
    >
      {copied ? `✓ ${t('copied')}` : t('copyUrl')}
    </button>
  );
}
