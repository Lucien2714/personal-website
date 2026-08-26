'use client';

import {useRouter} from 'next/navigation';
import {useState, useTransition} from 'react';
import {useTranslations} from 'next-intl';

import {
  type TaxonomySuggestion,
  deletePostAction,
  savePostAction,
} from '@/app/[locale]/admin/(console)/posts/actions';
import {MarkdownEditor} from '@/components/admin/MarkdownEditor';
import {TokenInput} from '@/components/admin/TokenInput';
import type {Locale, PublishStatus} from '@/generated/prisma/enums';
import {type AppLocale, localeLabels} from '@/i18n/routing';
import type {
  EditorTranslation,
  PostEditorValue,
} from '@/lib/admin/editor-value';
import {statusMessageKey} from '@/lib/admin/status';
import {cn} from '@/lib/utils/cn';

/**
 * The bilingual post editor.
 *
 * Both language versions are edited in one form, behind a pair of tabs, and
 * saved in one action. Keeping them together is what makes the "translate this
 * post" workflow bearable: the author can flip between the two renditions
 * without leaving the page or worrying about which half was saved.
 *
 * Everything below is local state until Save is pressed. The alternative -
 * autosaving each keystroke - would need conflict handling and revision
 * history to be safe, which is a much larger feature than this needs to be.
 */

/** Locale tabs, in display order. */
const LOCALE_TABS: Array<{locale: Locale; app: AppLocale}> = [
  {locale: 'EN', app: 'en'},
  {locale: 'ZH', app: 'zh'},
];

/** Statuses offered in the editor. `ARCHIVED` is reached by deleting. */
const STATUSES: PublishStatus[] = ['DRAFT', 'SCHEDULED', 'PUBLISHED'];

/** Shared class list for the plain text inputs. */
const INPUT_CLASS =
  'w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] px-3.5 py-2.5 text-sm outline-none transition focus:border-[var(--color-sakura)]';

/** Renders the editor. */
export function PostEditor({
  initialValue,
  suggestions,
  locale,
}: {
  initialValue: PostEditorValue;
  suggestions: {categories: TaxonomySuggestion[]; tags: TaxonomySuggestion[]};
  locale: AppLocale;
}) {
  const t = useTranslations('admin');
  const router = useRouter();

  const [value, setValue] = useState<PostEditorValue>(initialValue);
  const [activeLocale, setActiveLocale] = useState<Locale>(
    initialValue.translations[0]?.locale ?? 'EN',
  );
  const [saveState, setSaveState] = useState<'idle' | 'saved' | 'error'>(
    'idle',
  );
  const [errors, setErrors] = useState<string[]>([]);
  const [isSaving, startSaving] = useTransition();

  const active =
    value.translations.find((item) => item.locale === activeLocale) ??
    value.translations[0];

  /** Applies a partial update to the active translation. */
  const updateTranslation = (patch: Partial<EditorTranslation>) => {
    setValue((current) => ({
      ...current,
      translations: current.translations.map((translation) =>
        translation.locale === activeLocale
          ? {...translation, ...patch}
          : translation,
      ),
    }));
    setSaveState('idle');
  };

  /** Applies a partial update to the post's shared fields. */
  const updatePost = (patch: Partial<PostEditorValue>) => {
    setValue((current) => ({...current, ...patch}));
    setSaveState('idle');
  };

  const handleSave = () => {
    startSaving(async () => {
      const result = await savePostAction({
        ...value,
        publishedAt: value.publishedAt
          ? new Date(value.publishedAt).toISOString()
          : undefined,
        coverUrl: value.coverUrl || undefined,
        translations: value.translations.map((translation) => ({
          ...translation,
          slug: translation.slug || undefined,
          description: translation.description || undefined,
        })),
      });

      if (!result.ok) {
        setSaveState('error');
        setErrors(
          result.errors?.map((error) => `${error.path}: ${error.message}`) ?? [
            result.message ?? 'Save failed.',
          ],
        );
        return;
      }

      setErrors([]);
      setSaveState('saved');

      // A newly created post has no id in the URL yet; move to its own page so
      // that the next save updates rather than creates.
      if (!value.id && result.postId) {
        router.replace(`/${locale}/admin/posts/${result.postId}`);
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
      const result = await deletePostAction(value.id as string);
      if (result.ok) {
        router.push(`/${locale}/admin/posts`);
      }
    });
  };

  if (!active) {
    return null;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-2">
        <div
          className="flex rounded-full border border-[var(--color-border)] p-0.5"
          role="tablist"
          aria-label={t('localeTab', {locale: ''})}
        >
          {LOCALE_TABS.map((tab) => {
            const translation = value.translations.find(
              (item) => item.locale === tab.locale,
            );
            const hasContent = Boolean(
              translation && translation.title.trim().length > 0,
            );

            return (
              <button
                key={tab.locale}
                type="button"
                role="tab"
                aria-selected={activeLocale === tab.locale}
                onClick={() => setActiveLocale(tab.locale)}
                className={cn(
                  'rounded-full px-3.5 py-1.5 text-sm font-medium transition',
                  activeLocale === tab.locale
                    ? 'bg-[var(--color-sakura)] text-white'
                    : 'text-[var(--color-ink-muted)] hover:text-[var(--color-sakura)]',
                )}
              >
                {localeLabels[tab.app]}
                {!hasContent && (
                  <span aria-hidden="true" className="ml-1 opacity-50">
                    ○
                  </span>
                )}
              </button>
            );
          })}
        </div>

        <div className="ml-auto flex items-center gap-2">
          {saveState === 'saved' && (
            <span className="text-sm text-[var(--color-success)]">
              ✓ {t('saved')}
            </span>
          )}
          {value.id && (
            <button
              type="button"
              onClick={handleDelete}
              disabled={isSaving}
              className="rounded-full border border-[var(--color-border)] px-4 py-2 text-sm font-medium text-[var(--color-ink-muted)] transition hover:border-[var(--color-danger)] hover:text-[var(--color-danger)] disabled:opacity-50"
            >
              {t('delete')}
            </button>
          )}
          <button
            type="button"
            onClick={handleSave}
            disabled={isSaving}
            className="rounded-full bg-[var(--color-sakura)] px-5 py-2 text-sm font-semibold text-white transition hover:opacity-90 disabled:opacity-60"
          >
            {isSaving ? t('saving') : t('save')}
          </button>
        </div>
      </div>

      {errors.length > 0 && (
        <ul
          role="alert"
          className="space-y-1 rounded-xl bg-[var(--color-sakura-soft)] px-4 py-3 text-sm text-[var(--color-danger)]"
        >
          {errors.map((error) => (
            <li key={error}>{error}</li>
          ))}
        </ul>
      )}

      <div className="grid gap-6 lg:grid-cols-[1fr_15rem]">
        <div className="min-w-0 space-y-4">
          <div className="space-y-1.5">
            <label
              htmlFor="post-title"
              className="block text-sm font-medium text-[var(--color-ink-muted)]"
            >
              {t('titleField')}
            </label>
            <input
              id="post-title"
              value={active.title}
              onChange={(event) =>
                updateTranslation({title: event.target.value})
              }
              className={cn(INPUT_CLASS, 'font-display text-lg font-semibold')}
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <label
                htmlFor="post-slug"
                className="block text-sm font-medium text-[var(--color-ink-muted)]"
              >
                {t('slugField')}
              </label>
              <input
                id="post-slug"
                value={active.slug}
                placeholder="auto"
                onChange={(event) =>
                  updateTranslation({slug: event.target.value})
                }
                className={cn(INPUT_CLASS, 'font-mono text-xs')}
              />
            </div>

            <div className="space-y-1.5">
              <label
                htmlFor="post-cover"
                className="block text-sm font-medium text-[var(--color-ink-muted)]"
              >
                {t('coverField')}
              </label>
              <input
                id="post-cover"
                value={value.coverUrl}
                placeholder="/uploads/2026/08/cover.png"
                onChange={(event) => updatePost({coverUrl: event.target.value})}
                className={cn(INPUT_CLASS, 'font-mono text-xs')}
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <label
              htmlFor="post-description"
              className="block text-sm font-medium text-[var(--color-ink-muted)]"
            >
              {t('descriptionField')}
            </label>
            <textarea
              id="post-description"
              value={active.description}
              rows={2}
              onChange={(event) =>
                updateTranslation({description: event.target.value})
              }
              className={INPUT_CLASS}
            />
          </div>

          <MarkdownEditor
            label={t('bodyField')}
            value={active.bodyMarkdown}
            onChange={(bodyMarkdown) => updateTranslation({bodyMarkdown})}
          />
        </div>

        <aside className="space-y-4">
          <div className="space-y-1.5">
            <label
              htmlFor="post-status"
              className="block text-sm font-medium text-[var(--color-ink-muted)]"
            >
              {t('status')}
            </label>
            <select
              id="post-status"
              value={value.status}
              onChange={(event) =>
                updatePost({status: event.target.value as PublishStatus})
              }
              className={INPUT_CLASS}
            >
              {STATUSES.map((status) => (
                <option key={status} value={status}>
                  {t(statusMessageKey(status))}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-1.5">
            <label
              htmlFor="post-published-at"
              className="block text-sm font-medium text-[var(--color-ink-muted)]"
            >
              {t('publishedAtField')}
            </label>
            <input
              id="post-published-at"
              type="datetime-local"
              value={value.publishedAt}
              onChange={(event) =>
                updatePost({publishedAt: event.target.value})
              }
              className={INPUT_CLASS}
            />
          </div>

          <label className="flex items-center gap-2.5 text-sm">
            <input
              type="checkbox"
              checked={value.pinned}
              onChange={(event) => updatePost({pinned: event.target.checked})}
              className="h-4 w-4 accent-[var(--color-sakura)]"
            />
            {t('pinnedField')}
          </label>

          <TokenInput
            label={t('categoriesField')}
            values={value.categories}
            onChange={(categories) => updatePost({categories})}
            suggestions={suggestions.categories.map((item) => item.name)}
          />

          <TokenInput
            label={t('tagsField')}
            values={value.tags}
            onChange={(tags) => updatePost({tags})}
            suggestions={suggestions.tags.map((item) => item.name)}
          />
        </aside>
      </div>
    </div>
  );
}
