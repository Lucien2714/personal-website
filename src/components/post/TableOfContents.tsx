'use client';

import {useEffect, useState} from 'react';
import {useTranslations} from 'next-intl';

import type {TocEntry} from '@/lib/content/markdown';
import {cn} from '@/lib/utils/cn';

/**
 * A sticky table of contents that highlights the section currently in view.
 *
 * Uses an IntersectionObserver rather than a scroll listener: the browser does
 * the bookkeeping off the main thread, so the highlight stays in step during a
 * fast scroll without the component running code on every frame.
 */
export function TableOfContents({entries}: {entries: TocEntry[]}) {
  const t = useTranslations('post');
  const [activeId, setActiveId] = useState<string | null>(null);

  useEffect(() => {
    if (entries.length === 0) {
      return;
    }

    const headings = entries
      .map((entry) => document.getElementById(entry.id))
      .filter((element): element is HTMLElement => element !== null);

    if (headings.length === 0) {
      return;
    }

    const observer = new IntersectionObserver(
      (records) => {
        // Several headings can be on screen at once; the topmost visible one
        // is the section the reader is actually in.
        const visible = records
          .filter((record) => record.isIntersecting)
          .sort(
            (left, right) =>
              left.boundingClientRect.top - right.boundingClientRect.top,
          );

        if (visible[0]) {
          setActiveId(visible[0].target.id);
        }
      },
      {
        // Treat the band just below the sticky header as "current".
        rootMargin: '-88px 0px -70% 0px',
        threshold: 0,
      },
    );

    for (const heading of headings) {
      observer.observe(heading);
    }

    return () => {
      observer.disconnect();
    };
  }, [entries]);

  if (entries.length === 0) {
    return null;
  }

  return (
    <nav aria-labelledby="toc-heading" className="text-sm">
      <h2
        id="toc-heading"
        className="mb-3 font-display text-xs font-bold uppercase tracking-wide text-[var(--color-ink-subtle)]"
      >
        {t('tableOfContents')}
      </h2>
      <ul className="space-y-1.5 border-l border-[var(--color-border)]">
        {entries.map((entry) => (
          <li key={entry.id}>
            <a
              href={`#${entry.id}`}
              aria-current={entry.id === activeId ? 'location' : undefined}
              className={cn(
                '-ml-px block border-l-2 py-0.5 pl-3 transition',
                entry.depth === 3 && 'pl-6 text-[0.82rem]',
                entry.id === activeId
                  ? 'border-[var(--color-sakura)] font-medium text-[var(--color-sakura)]'
                  : 'border-transparent text-[var(--color-ink-muted)] hover:text-[var(--color-ink)]',
              )}
            >
              {entry.text}
            </a>
          </li>
        ))}
      </ul>
    </nav>
  );
}
