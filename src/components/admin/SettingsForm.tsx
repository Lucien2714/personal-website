'use client';

import {useRouter} from 'next/navigation';
import {useState, useTransition} from 'react';
import {useTranslations} from 'next-intl';

import {saveSettingsAction} from '@/app/[locale]/admin/(console)/settings/actions';
import type {SiteSettings} from '@/lib/content/settings';
import {cn} from '@/lib/utils/cn';

/**
 * The site settings form.
 *
 * Covers the values an owner changes without wanting a deploy: the avatar, the
 * hero copy in each language, and the social links in the footer.
 */

/** Icon identifiers the footer knows how to render. */
const ICONS = ['github', 'twitter', 'bilibili', 'mail', 'rss', 'link'] as const;

/** Shared class list for the text inputs. */
const INPUT_CLASS =
  'w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] px-3.5 py-2.5 text-sm outline-none transition focus:border-[var(--color-sakura)]';

/** A labelled text field. */
function Field({
  label,
  value,
  onChange,
  placeholder,
  mono = false,
}: {
  label: string;
  value: string;
  onChange: (next: string) => void;
  placeholder?: string;
  mono?: boolean;
}) {
  return (
    <label className="block space-y-1.5">
      <span className="block text-sm font-medium text-[var(--color-ink-muted)]">
        {label}
      </span>
      <input
        value={value}
        placeholder={placeholder}
        onChange={(event) => onChange(event.target.value)}
        className={cn(INPUT_CLASS, mono && 'font-mono text-xs')}
      />
    </label>
  );
}

/** Renders the settings form. */
export function SettingsForm({initial}: {initial: SiteSettings}) {
  const t = useTranslations('admin');
  const router = useRouter();

  const [settings, setSettings] = useState<SiteSettings>(initial);
  const [message, setMessage] = useState<string | null>(null);
  const [isSaving, startSaving] = useTransition();

  /** Applies a partial update. */
  const patch = (next: Partial<SiteSettings>) => {
    setSettings((current) => ({...current, ...next}));
    setMessage(null);
  };

  const handleSave = () => {
    startSaving(async () => {
      const result = await saveSettingsAction(settings);
      setMessage(result.ok ? t('saved') : result.message);
      if (result.ok) {
        router.refresh();
      }
    });
  };

  return (
    <div className="space-y-6">
      <section className="card space-y-4 p-5">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field
            label="Author name"
            value={settings.authorName}
            onChange={(authorName) => patch({authorName})}
          />
          <Field
            label="Avatar URL"
            value={settings.avatarUrl}
            onChange={(avatarUrl) => patch({avatarUrl})}
            mono
          />
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field
            label="Hero headline (EN)"
            value={settings.heroHeadline.en}
            onChange={(en) =>
              patch({heroHeadline: {...settings.heroHeadline, en}})
            }
          />
          <Field
            label="Hero headline (中文)"
            value={settings.heroHeadline.zh}
            onChange={(zh) =>
              patch({heroHeadline: {...settings.heroHeadline, zh}})
            }
          />
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block space-y-1.5">
            <span className="block text-sm font-medium text-[var(--color-ink-muted)]">
              Hero subline (EN)
            </span>
            <textarea
              value={settings.heroSubline.en}
              rows={3}
              onChange={(event) =>
                patch({
                  heroSubline: {
                    ...settings.heroSubline,
                    en: event.target.value,
                  },
                })
              }
              className={INPUT_CLASS}
            />
          </label>

          <label className="block space-y-1.5">
            <span className="block text-sm font-medium text-[var(--color-ink-muted)]">
              Hero subline (中文)
            </span>
            <textarea
              value={settings.heroSubline.zh}
              rows={3}
              onChange={(event) =>
                patch({
                  heroSubline: {
                    ...settings.heroSubline,
                    zh: event.target.value,
                  },
                })
              }
              className={INPUT_CLASS}
            />
          </label>
        </div>

        <Field
          label="Source repository URL"
          value={settings.sourceRepoUrl}
          onChange={(sourceRepoUrl) => patch({sourceRepoUrl})}
          placeholder="https://github.com/lucien2714/personal-website"
          mono
        />
      </section>

      <section className="card space-y-3 p-5">
        <h3 className="font-display text-sm font-bold uppercase tracking-wide text-[var(--color-ink-subtle)]">
          Social links
        </h3>

        <ul className="space-y-2">
          {settings.socialLinks.map((link, index) => (
            <li
              key={`${link.url}-${index}`}
              className="grid gap-2 sm:grid-cols-[7rem_1fr_8rem_auto]"
            >
              <input
                value={link.label}
                onChange={(event) => {
                  const next = [...settings.socialLinks];
                  next[index] = {...link, label: event.target.value};
                  patch({socialLinks: next});
                }}
                className={INPUT_CLASS}
              />
              <input
                value={link.url}
                onChange={(event) => {
                  const next = [...settings.socialLinks];
                  next[index] = {...link, url: event.target.value};
                  patch({socialLinks: next});
                }}
                className={cn(INPUT_CLASS, 'font-mono text-xs')}
              />
              <select
                value={link.icon}
                onChange={(event) => {
                  const next = [...settings.socialLinks];
                  next[index] = {
                    ...link,
                    icon: event.target.value as (typeof ICONS)[number],
                  };
                  patch({socialLinks: next});
                }}
                className={INPUT_CLASS}
              >
                {ICONS.map((icon) => (
                  <option key={icon} value={icon}>
                    {icon}
                  </option>
                ))}
              </select>
              <button
                type="button"
                onClick={() =>
                  patch({
                    socialLinks: settings.socialLinks.filter(
                      (_, position) => position !== index,
                    ),
                  })
                }
                className="rounded-full border border-[var(--color-border)] px-3 py-1 text-xs transition hover:border-[var(--color-danger)] hover:text-[var(--color-danger)]"
              >
                {t('delete')}
              </button>
            </li>
          ))}
        </ul>

        <button
          type="button"
          onClick={() =>
            patch({
              socialLinks: [
                ...settings.socialLinks,
                {label: '', url: 'https://', icon: 'link'},
              ],
            })
          }
          className="rounded-full border border-[var(--color-border)] px-4 py-1.5 text-xs font-medium transition hover:border-[var(--color-sakura)] hover:text-[var(--color-sakura)]"
        >
          + Add link
        </button>
      </section>

      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={handleSave}
          disabled={isSaving}
          className="rounded-full bg-[var(--color-sakura)] px-5 py-2 text-sm font-semibold text-white transition hover:opacity-90 disabled:opacity-60"
        >
          {isSaving ? t('saving') : t('save')}
        </button>
        {message && (
          <span className="text-sm text-[var(--color-ink-muted)]">
            {message}
          </span>
        )}
      </div>
    </div>
  );
}
