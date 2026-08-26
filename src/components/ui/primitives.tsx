import type {ReactNode} from 'react';

import {cn} from '@/lib/utils/cn';

/**
 * Small, presentation-only building blocks shared across pages.
 *
 * They live together because each is a handful of lines with no behaviour and
 * no state; splitting them into separate modules would add import noise
 * without adding clarity. Anything that grows logic moves out into its own
 * file.
 */

/** Centres page content and applies the standard horizontal gutter. */
export function Container({
  children,
  className,
  size = 'default',
}: {
  children: ReactNode;
  className?: string;
  /** `wide` is used by index pages, `narrow` by long-form reading. */
  size?: 'narrow' | 'default' | 'wide';
}) {
  const widths = {
    narrow: 'max-w-2xl',
    default: 'max-w-3xl',
    wide: 'max-w-5xl',
  } as const;

  return (
    <div className={cn('mx-auto w-full px-4', widths[size], className)}>
      {children}
    </div>
  );
}

/**
 * The title block that opens an index page.
 *
 * The accent rule above the title carries the section's identity, replacing
 * the emoji each page used to pass in. One typographic device applied
 * consistently reads as deliberate; a different pictogram per page reads as
 * decoration.
 */
export function PageHeader({
  title,
  subtitle,
}: {
  title: string;
  subtitle?: string;
}) {
  return (
    <div className="mb-8 pt-10 sm:pt-14">
      <span
        aria-hidden="true"
        className="mb-4 block h-0.5 w-10 rounded-full bg-[var(--color-accent)]"
      />
      <h1 className="font-display text-3xl font-bold sm:text-4xl">{title}</h1>
      {subtitle && (
        <p className="mt-2.5 text-[var(--color-ink-muted)]">{subtitle}</p>
      )}
    </div>
  );
}

/** Placeholder shown where a list has no items yet. */
export function EmptyState({
  message,
  action,
}: {
  message: string;
  action?: ReactNode;
}) {
  return (
    <div className="card flex flex-col items-center gap-3 px-6 py-14 text-center">
      <span aria-hidden="true" className="text-3xl opacity-70">
        ◇
      </span>
      <p className="text-[var(--color-ink-muted)]">{message}</p>
      {action}
    </div>
  );
}

/** A rounded label for a tag, category or status. */
export function Chip({
  children,
  tone = 'accent',
  className,
}: {
  children: ReactNode;
  tone?: 'accent' | 'cyan' | 'violet' | 'mint' | 'neutral';
  className?: string;
}) {
  const tones = {
    accent: 'bg-[var(--color-accent-soft)] text-[var(--color-accent)]',
    cyan: 'bg-[var(--color-cyan-soft)] text-[var(--color-cyan)]',
    violet: 'bg-[var(--color-violet-soft)] text-[var(--color-violet)]',
    mint: 'bg-[var(--color-cyan-soft)] text-[var(--color-mint)]',
    neutral: 'bg-[var(--color-surface-sunken)] text-[var(--color-ink-muted)]',
  } as const;

  return <span className={cn('chip', tones[tone], className)}>{children}</span>;
}

/** A section heading with an optional "view all" affordance. */
export function SectionHeading({
  title,
  action,
}: {
  title: string;
  action?: ReactNode;
}) {
  return (
    <div className="mb-5 flex items-end justify-between gap-4">
      <h2 className="flex items-center gap-2.5 font-display text-xl font-bold sm:text-2xl">
        <span
          aria-hidden="true"
          className="h-4 w-0.5 rounded-full bg-[var(--color-accent)]"
        />
        {title}
      </h2>
      {action}
    </div>
  );
}
