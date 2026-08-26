'use client';

import {useRouter} from 'next/navigation';
import {useState, useTransition} from 'react';
import {useTranslations} from 'next-intl';

import {
  deleteProjectAction,
  saveProjectAction,
} from '@/app/[locale]/admin/(console)/projects/actions';
import {MarkdownEditor} from '@/components/admin/MarkdownEditor';
import {TokenInput} from '@/components/admin/TokenInput';
import type {Locale} from '@/generated/prisma/enums';
import type {
  ProjectEditorTranslation,
  ProjectEditorValue,
} from '@/lib/admin/project-editor-value';
import {type AppLocale, localeLabels} from '@/i18n/routing';
import {cn} from '@/lib/utils/cn';

/**
 * The project editor.
 *
 * Structurally the same as the post editor - two language tabs over shared
 * metadata - with one addition that matters: `embedUrl`. Setting it makes the
 * project page host that URL in a sandboxed iframe, which is how another of
 * your applications appears inside this site.
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
export function ProjectEditor({
  initialValue,
  locale,
}: {
  initialValue: ProjectEditorValue;
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

  const updateTranslation = (patch: Partial<ProjectEditorTranslation>) => {
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

  const updateProject = (patch: Partial<ProjectEditorValue>) => {
    setValue((current) => ({...current, ...patch}));
    setMessage(null);
  };

  const handleSave = () => {
    startSaving(async () => {
      const result = await saveProjectAction({
        ...value,
        slug: value.slug || undefined,
        repoUrl: value.repoUrl || undefined,
        liveUrl: value.liveUrl || undefined,
        embedUrl: value.embedUrl || undefined,
        embedHeight: value.embedHeight
          ? Number.parseInt(value.embedHeight, 10)
          : undefined,
        coverUrl: value.coverUrl || undefined,
        sortOrder: Number.parseInt(value.sortOrder, 10) || 0,
        translations: value.translations.map((translation) => ({
          ...translation,
          bodyMarkdown: translation.bodyMarkdown || undefined,
        })),
      });

      if (!result.ok) {
        setMessage(result.message ?? 'Save failed.');
        return;
      }

      setMessage(t('saved'));
      if (!value.id && result.projectId) {
        router.replace(`/${locale}/admin/projects/${result.projectId}`);
      } else {
        router.refresh();
      }
    });
  };

  const handleDelete = () => {
    if (!value.id || !window.confirm(t('confirmDelete'))) {
      return;
    }

    startSaving(async () => {
      const result = await deleteProjectAction(value.id as string);
      if (result.ok) {
        router.push(`/${locale}/admin/projects`);
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
          {value.id && (
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

      <div className="grid gap-6 lg:grid-cols-[1fr_16rem]">
        <div className="min-w-0 space-y-4">
          <label className="block space-y-1.5">
            <span className="block text-sm font-medium text-[var(--color-ink-muted)]">
              {t('titleField')}
            </span>
            <input
              value={active.name}
              onChange={(event) =>
                updateTranslation({name: event.target.value})
              }
              className={cn(INPUT_CLASS, 'font-display text-lg font-semibold')}
            />
          </label>

          <label className="block space-y-1.5">
            <span className="block text-sm font-medium text-[var(--color-ink-muted)]">
              {t('descriptionField')}
            </span>
            <textarea
              value={active.summary}
              rows={2}
              onChange={(event) =>
                updateTranslation({summary: event.target.value})
              }
              className={INPUT_CLASS}
            />
          </label>

          <MarkdownEditor
            label={t('bodyField')}
            value={active.bodyMarkdown}
            onChange={(bodyMarkdown) => updateTranslation({bodyMarkdown})}
            rows={12}
          />
        </div>

        <aside className="space-y-4">
          <label className="block space-y-1.5">
            <span className="block text-sm font-medium text-[var(--color-ink-muted)]">
              {t('slugField')}
            </span>
            <input
              value={value.slug}
              placeholder="auto"
              onChange={(event) => updateProject({slug: event.target.value})}
              className={cn(INPUT_CLASS, 'font-mono text-xs')}
            />
          </label>

          <label className="block space-y-1.5">
            <span className="block text-sm font-medium text-[var(--color-ink-muted)]">
              {t('status')}
            </span>
            <select
              value={value.status}
              onChange={(event) =>
                updateProject({
                  status: event.target.value as ProjectEditorValue['status'],
                })
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
              Repository URL
            </span>
            <input
              value={value.repoUrl}
              onChange={(event) => updateProject({repoUrl: event.target.value})}
              className={cn(INPUT_CLASS, 'font-mono text-xs')}
            />
          </label>

          <label className="block space-y-1.5">
            <span className="block text-sm font-medium text-[var(--color-ink-muted)]">
              Live URL
            </span>
            <input
              value={value.liveUrl}
              onChange={(event) => updateProject({liveUrl: event.target.value})}
              className={cn(INPUT_CLASS, 'font-mono text-xs')}
            />
          </label>

          <div className="space-y-1.5 rounded-xl border border-dashed border-[var(--color-border-strong)] p-3">
            <p className="text-xs text-[var(--color-ink-subtle)]">
              Set an embed URL to render this project inside a sandboxed iframe
              on its page.
            </p>
            <input
              value={value.embedUrl}
              placeholder="https://pred.lucien2714.com/widget"
              onChange={(event) =>
                updateProject({embedUrl: event.target.value})
              }
              className={cn(INPUT_CLASS, 'font-mono text-xs')}
            />
            <input
              value={value.embedHeight}
              placeholder="520"
              inputMode="numeric"
              onChange={(event) =>
                updateProject({embedHeight: event.target.value})
              }
              className={cn(INPUT_CLASS, 'font-mono text-xs')}
            />
          </div>

          <label className="block space-y-1.5">
            <span className="block text-sm font-medium text-[var(--color-ink-muted)]">
              {t('coverField')}
            </span>
            <input
              value={value.coverUrl}
              onChange={(event) =>
                updateProject({coverUrl: event.target.value})
              }
              className={cn(INPUT_CLASS, 'font-mono text-xs')}
            />
          </label>

          <TokenInput
            label="Tech stack"
            values={value.techStack}
            onChange={(techStack) => updateProject({techStack})}
          />

          <div className="grid grid-cols-2 gap-3">
            <label className="block space-y-1.5">
              <span className="block text-sm font-medium text-[var(--color-ink-muted)]">
                Order
              </span>
              <input
                value={value.sortOrder}
                inputMode="numeric"
                onChange={(event) =>
                  updateProject({sortOrder: event.target.value})
                }
                className={INPUT_CLASS}
              />
            </label>

            <label className="flex items-end gap-2 pb-2.5 text-sm">
              <input
                type="checkbox"
                checked={value.featured}
                onChange={(event) =>
                  updateProject({featured: event.target.checked})
                }
                className="h-4 w-4 accent-[var(--color-accent)]"
              />
              Featured
            </label>
          </div>
        </aside>
      </div>
    </div>
  );
}
