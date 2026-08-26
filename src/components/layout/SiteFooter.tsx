import {getTranslations} from 'next-intl/server';

import {Link} from '@/i18n/navigation';
import {getSiteSettings} from '@/lib/content/settings';

/** Maps an icon identifier to the glyph used in the footer. */
const SOCIAL_GLYPHS: Record<string, string> = {
  github: '⌥',
  twitter: '𝕏',
  bilibili: '📺',
  mail: '✉',
  rss: '📡',
  link: '🔗',
};

/**
 * The site footer.
 *
 * A server component, so the social links and repository URL come straight
 * from the settings row without shipping a client bundle for what is a static
 * list of anchors.
 */
export async function SiteFooter() {
  const [t, settings] = await Promise.all([
    getTranslations('footer'),
    getSiteSettings(),
  ]);

  return (
    <footer className="mt-20 border-t border-[var(--color-border)]">
      <div className="mx-auto flex max-w-5xl flex-col gap-4 px-4 py-8 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-[var(--color-ink-subtle)]">
          {t('rights', {year: new Date().getFullYear()})}
          <span className="mx-2" aria-hidden="true">
            ·
          </span>
          {t('builtWith')}
        </p>

        <nav className="flex flex-wrap items-center gap-4 text-sm">
          {settings.socialLinks.map((link) => (
            <a
              key={link.url}
              href={link.url}
              target="_blank"
              rel="noopener noreferrer me"
              className="text-[var(--color-ink-muted)] transition hover:text-[var(--color-accent)]"
            >
              <span aria-hidden="true" className="mr-1">
                {SOCIAL_GLYPHS[link.icon] ?? SOCIAL_GLYPHS.link}
              </span>
              {link.label}
            </a>
          ))}

          <Link
            href="/feed.xml"
            className="text-[var(--color-ink-muted)] transition hover:text-[var(--color-accent)]"
          >
            {t('feed')}
          </Link>

          {/* A route handler, not a page: `next/link` would try to prefetch
              an RSC payload that does not exist. */}
          {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
          <a
            href="/api/v1"
            className="text-[var(--color-ink-muted)] transition hover:text-[var(--color-accent)]"
          >
            {t('api')}
          </a>

          {settings.sourceRepoUrl && (
            <a
              href={settings.sourceRepoUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-[var(--color-ink-muted)] transition hover:text-[var(--color-accent)]"
            >
              {t('sourceCode')}
            </a>
          )}
        </nav>
      </div>
    </footer>
  );
}
