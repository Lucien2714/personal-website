import {useFormatter} from 'next-intl';

/**
 * Renders a date as a machine-readable `<time>` element.
 *
 * The visible text is formatted for the active locale, which puts the year
 * first in Chinese and the month first in English, while the `dateTime`
 * attribute keeps an ISO 8601 value for feed readers and search engines.
 */
export function FormattedDate({
  value,
  /** `long` for article headers, `short` for dense lists. */
  variant = 'long',
  className,
}: {
  value: Date;
  variant?: 'long' | 'short' | 'relative';
  className?: string;
}) {
  const format = useFormatter();

  const text =
    variant === 'relative'
      ? format.relativeTime(value)
      : format.dateTime(value, {
          year: 'numeric',
          month: variant === 'long' ? 'long' : 'short',
          day: 'numeric',
        });

  return (
    <time dateTime={value.toISOString()} className={className}>
      {text}
    </time>
  );
}
