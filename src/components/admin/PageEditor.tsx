'use client';

import {useRouter} from 'next/navigation';
import {useState, useTransition} from 'react';
import {useTranslations} from 'next-intl';

import {
  deletePageAction,
  savePageAction,
} from '@/app/[locale]/admin/(console)/pages/actions';
import {MarkdownEditor} from '@/components/admin/MarkdownEditor';
import type {Locale} from '@/generated/prisma/enums';
import type {
  PageEditorTranslation,
  PageEditorValue,
} from '@/lib/admin/page-editor-value';
import {type AppLocale, localeLabels} from '@/i18n/routing';
import {cn} from '@/lib/utils/cn';

/**
 * The standalone-page editor.
 *
 * This is what makes About (and anything like it) content rather than code:
 * the same Markdown pipeline, the same two language tabs, and a navigation
 * position so the page can put itself in the header.
 */

/** Locale tabs, in display order. */
const LOCALE_TABS: Array<{locale: Locale; app: AppLocale}> = [
  {locale: 'EN', app: 'en'},
  {locale: 'ZH', app: 'zh'},
];

/** Shared class list for the text inputs. */
const INPUT_CLASS =
  'w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] px-3.5 py-2.5 text-sm outline-none transition focus:border-[var(--color-accent)]';

/** Renders the editor. */
export function PageEditor({
  initialValue,
  locale,
}: {
  initialValue: PageEditorValue;
  locale: AppLocale;
}) {
  const t = useTranslations('admin');
  const router = useRouter();

  const [value, setValue] = useState(initialValue);
  const [activeLocale, setActiveLocale] = useState<Locale>('EN');
  const [message, setMessage] = useState<string | null>(null);
  const [isSaving, startSaving] = useTransition();

  const active =
    value.translations.find((item) => item.locale === activeLocale) ??
    value.translations[0];

  const updateTranslation = (patch: Partial<PageEditorTranslation>) => {
    setValue((current) => ({
      ...current,
      translations: current.translations.map((translation) =>
        translation.locale === activeLocale
          ? {...translation, ...patch}
          : translation,
      ),
    }));
    setMessage(null);
  };

  const handleSave = () => {
    startSaving(async () => {
      const result = await savePageAction({
        ...value,
        navOrder: value.navOrder ? Number.parseInt(value.navOrder, 10) : null,
        icon: value.icon || undefined,
      });

      if (!result.ok) {
        setMessage(result.message ?? 'Save failed.');
        return;
      }

      setMessage(t('saved'));
      if (!value.originalSlug && result.slug) {
        router.replace(`/${locale}/admin/pages/${result.slug}`);
      } else {
        router.refresh();
      }
    });
  };

  const handleDelete = () => {
    if (!value.originalSlug || !window.confirm(t('confirmDelete'))) {
      return;
    }

    startSaving(async () => {
      const result = await deletePageAction(value.originalSlug as string);
      if (result.ok) {
        router.push(`/${locale}/admin/pages`);
      }
    });
  };

  if (!active) {
    return null;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex rounded-lg border border-[var(--color-border)] p-0.5">
          {LOCALE_TABS.map((tab) => (
            <button
              key={tab.locale}
              type="button"
              onClick={() => setActiveLocale(tab.locale)}
              aria-pressed={activeLocale === tab.locale}
              className={cn(
                'rounded-md px-3.5 py-1.5 text-sm font-medium transition',
                activeLocale === tab.locale
                  ? 'bg-[var(--color-accent)] text-[var(--color-on-accent)]'
                  : 'text-[var(--color-ink-muted)] hover:text-[var(--color-accent)]',
              )}
            >
              {localeLabels[tab.app]}
            </button>
          ))}
        </div>

        <div className="ml-auto flex items-center gap-2">
          {message && (
            <span className="text-sm text-[var(--color-ink-muted)]">
              {message}
            </span>
          )}
          {value.originalSlug && (
            <button
              type="button"
              onClick={handleDelete}
              disabled={isSaving}
              className="rounded-lg border border-[var(--color-border)] px-4 py-2 text-sm font-medium text-[var(--color-ink-muted)] transition hover:border-[var(--color-danger)] hover:text-[var(--color-danger)] disabled:opacity-50"
            >
              {t('delete')}
            </button>
          )}
          <button
            type="button"
            onClick={handleSave}
            disabled={isSaving}
            className="rounded-lg bg-[var(--color-accent)] px-5 py-2 text-sm font-semibold text-[var(--color-on-accent)] transition hover:opacity-90 disabled:opacity-60"
          >
            {isSaving ? t('saving') : t('save')}
          </button>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <label className="block space-y-1.5">
          <span className="block text-sm font-medium text-[var(--color-ink-muted)]">
            {t('slugField')}
          </span>
          <input
            value={value.slug}
            // Changing the slug of an existing page would silently break every
            // link to it, so it is fixed once created.
            readOnly={Boolean(value.originalSlug)}
            placeholder="about"
            onChange={(event) =>
              setValue((current) => ({...current, slug: event.target.value}))
            }
            className={cn(
              INPUT_CLASS,
              'font-mono text-xs',
              value.originalSlug && 'opacity-60',
            )}
          />
        </label>

        <label className="block space-y-1.5">
          <span className="block text-sm font-medium text-[var(--color-ink-muted)]">
            {t('status')}
          </span>
          <select
            value={value.status}
            onChange={(event) =>
              setValue((current) => ({
                ...current,
                status: event.target.value as PageEditorValue['status'],
              }))
            }
            className={INPUT_CLASS}
          >
            <option value="PUBLISHED">{t('statusPublished')}</option>
            <option value="DRAFT">{t('statusDraft')}</option>
            <option value="ARCHIVED">{t('statusArchived')}</option>
          </select>
        </label>

        <label className="block space-y-1.5">
          <span className="block text-sm font-medium text-[var(--color-ink-muted)]">
            Nav order
          </span>
          <input
            value={value.navOrder}
            inputMode="numeric"
            placeholder="hidden"
            onChange={(event) =>
              setValue((current) => ({
                ...current,
                navOrder: event.target.value,
              }))
            }
            className={INPUT_CLASS}
          />
        </label>
      </div>

      <label className="block space-y-1.5">
        <span className="block text-sm font-medium text-[var(--color-ink-muted)]">
          {t('titleField')}
        </span>
        <input
          value={active.title}
          onChange={(event) => updateTranslation({title: event.target.value})}
          className={cn(INPUT_CLASS, 'font-display text-lg font-semibold')}
        />
      </label>

      <MarkdownEditor
        label={t('bodyField')}
        value={active.bodyMarkdown}
        onChange={(bodyMarkdown) => updateTranslation({bodyMarkdown})}
      />
    </div>
  );
}
