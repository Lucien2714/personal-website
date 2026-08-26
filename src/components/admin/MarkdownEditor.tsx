'use client';

import {useCallback, useEffect, useId, useState, useTransition} from 'react';
import {useTranslations} from 'next-intl';

import {previewMarkdownAction} from '@/app/[locale]/admin/(console)/posts/actions';
import {cn} from '@/lib/utils/cn';

/**
 * A Markdown textarea with a server-rendered preview.
 *
 * The preview deliberately calls the same rendering pipeline the save path
 * uses, rather than a second, lighter client-side renderer. A preview that can
 * disagree with the stored result is worse than no preview: it teaches the
 * author to trust something that is not what readers will see.
 *
 * Rendering is debounced and only runs while the preview pane is open, so
 * typing does not generate a request per keystroke.
 */

/** How long to wait after the last keystroke before re-rendering. */
const PREVIEW_DEBOUNCE_MS = 600;

/** Renders the editor. */
export function MarkdownEditor({
  label,
  value,
  onChange,
  rows = 18,
}: {
  label: string;
  value: string;
  onChange: (next: string) => void;
  rows?: number;
}) {
  const t = useTranslations('admin');
  const [showPreview, setShowPreview] = useState(false);
  const [html, setHtml] = useState('');
  const [isRendering, startRendering] = useTransition();
  const textareaId = useId();

  const renderPreview = useCallback((markdown: string) => {
    startRendering(async () => {
      const result = await previewMarkdownAction(markdown);
      setHtml(result.html);
    });
  }, []);

  useEffect(() => {
    if (!showPreview) {
      return;
    }

    const timer = setTimeout(() => {
      renderPreview(value);
    }, PREVIEW_DEBOUNCE_MS);

    return () => {
      clearTimeout(timer);
    };
  }, [showPreview, value, renderPreview]);

  /** Inserts a Tab character instead of moving focus out of the textarea. */
  const handleKeyDown = (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key !== 'Tab' || event.shiftKey) {
      return;
    }

    event.preventDefault();
    const target = event.currentTarget;
    const {selectionStart, selectionEnd} = target;
    const next = `${value.slice(0, selectionStart)}  ${value.slice(selectionEnd)}`;
    onChange(next);

    // Restore the caret after React has re-rendered with the new value.
    requestAnimationFrame(() => {
      target.selectionStart = target.selectionEnd = selectionStart + 2;
    });
  };

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <label
          htmlFor={textareaId}
          className="block text-sm font-medium text-[var(--color-ink-muted)]"
        >
          {label}
        </label>

        <button
          type="button"
          onClick={() => setShowPreview((open) => !open)}
          aria-pressed={showPreview}
          className={cn(
            'rounded-lg px-3 py-1 text-xs font-semibold transition',
            showPreview
              ? 'bg-[var(--color-accent)] text-[var(--color-on-accent)]'
              : 'text-[var(--color-ink-muted)] hover:text-[var(--color-accent)]',
          )}
        >
          {t('preview')}
        </button>
      </div>

      <div className={cn('grid gap-3', showPreview && 'lg:grid-cols-2')}>
        <textarea
          id={textareaId}
          value={value}
          rows={rows}
          spellCheck={false}
          onChange={(event) => onChange(event.target.value)}
          onKeyDown={handleKeyDown}
          className="w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] px-3.5 py-3 font-mono text-[0.85rem] leading-relaxed outline-none transition focus:border-[var(--color-accent)]"
        />

        {showPreview && (
          <div
            className={cn(
              'max-h-[36rem] overflow-y-auto rounded-xl border p-4',
              'border-[var(--color-border)] bg-[var(--color-surface-sunken)]',
              isRendering && 'opacity-60',
            )}
          >
            {/* Produced by the same sanitising pipeline used when saving. */}
            <div
              className="prose-anime text-sm"
              dangerouslySetInnerHTML={{__html: html}}
            />
          </div>
        )}
      </div>
    </div>
  );
}
