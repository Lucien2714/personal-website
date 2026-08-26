import type {Metadata} from 'next';
import {notFound} from 'next/navigation';
import {setRequestLocale} from 'next-intl/server';

import {FormattedDate} from '@/components/ui/FormattedDate';
import {Container} from '@/components/ui/primitives';
import {type AppLocale, toAppLocale, toPrismaLocale} from '@/i18n/routing';
import {getPageBySlug} from '@/lib/content/pages';

/**
 * Editable standalone pages, such as `/about`.
 *
 * This is the lowest-priority route in the locale segment: Next.js matches
 * literal segments (`/posts`, `/projects`, `/admin`) before a dynamic one, so
 * this only sees slugs that no dedicated route claimed. Anything unrecognised
 * falls through to `notFound()`, which is what makes it safe to have a
 * catch-all here at all.
 */

export const dynamic = 'force-dynamic';

/** Builds the page metadata for the active locale. */
export async function generateMetadata({
  params,
}: {
  params: Promise<{locale: AppLocale; pageSlug: string}>;
}): Promise<Metadata> {
  const {locale, pageSlug} = await params;
  const page = await getPageBySlug(pageSlug, toPrismaLocale(locale));

  if (!page) {
    return {title: 'Not found'};
  }

  return {
    title: page.title,
    alternates: {canonical: `/${locale}/${page.slug}`},
  };
}

/** Renders one standalone page. */
export default async function StandalonePage({
  params,
}: {
  params: Promise<{locale: AppLocale; pageSlug: string}>;
}) {
  const {locale, pageSlug} = await params;
  setRequestLocale(locale);

  const page = await getPageBySlug(pageSlug, toPrismaLocale(locale));
  if (!page) {
    notFound();
  }

  return (
    <Container className="pb-16 pt-10 sm:pt-14">
      {/* The body may be in a different language from the shell when the
          requested translation does not exist. */}
      <article lang={toAppLocale(page.locale)}>
        <h1 className="font-display text-3xl font-bold sm:text-4xl">
          {page.title}
        </h1>

        <p className="mt-2 text-sm text-[var(--color-ink-subtle)]">
          <FormattedDate value={page.updatedAt} variant="short" />
        </p>

        {/* Sanitised at save time by src/lib/content/markdown.ts. */}
        <div
          className="prose-anime mt-8"
          dangerouslySetInnerHTML={{__html: page.bodyHtml}}
        />
      </article>
    </Container>
  );
}
