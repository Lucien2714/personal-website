import {getTranslations} from 'next-intl/server';

/**
 * Renders another one of your applications inside this page.
 *
 * This is the extension point the site is built around: a project row carries
 * an `embedUrl`, and whatever lives there appears here. The embedded app knows
 * nothing about this site, and this site knows nothing about the app beyond
 * its URL.
 *
 * Safety properties worth keeping if this is ever edited:
 *
 *   * `sandbox` withholds every capability by default and grants back only
 *     what an interactive demo needs. `allow-same-origin` is deliberately
 *     absent: with it, an embedded page served from this origin could reach
 *     into the parent document and read the admin session cookie.
 *   * `referrerPolicy` keeps the reader's current path out of the embedded
 *     app's request logs.
 *   * A plain link is rendered alongside, so a blocked or broken frame still
 *     leaves the reader a way through.
 */
export async function ProjectEmbed({
  url,
  name,
  height,
}: {
  url: string;
  name: string;
  /** Frame height in CSS pixels. Falls back to a 16:10-ish default. */
  height?: number | null;
}) {
  const t = await getTranslations('projects');

  return (
    <figure className="my-8">
      <div className="overflow-hidden rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] shadow-[var(--shadow-soft)]">
        <iframe
          src={url}
          title={t('embedTitle', {name})}
          height={height ?? 520}
          loading="lazy"
          referrerPolicy="no-referrer"
          sandbox="allow-scripts allow-forms allow-popups allow-popups-to-escape-sandbox"
          className="block w-full border-0"
        />
      </div>

      <figcaption className="mt-2 text-center text-xs text-[var(--color-ink-subtle)]">
        <a
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          className="underline-offset-4 hover:underline"
        >
          {t('embedFallback')}
        </a>
      </figcaption>
    </figure>
  );
}
