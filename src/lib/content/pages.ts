import type {Locale} from '@/generated/prisma/enums';
import {db} from '@/lib/db';

/**
 * Read-side queries for standalone pages such as `/about`.
 *
 * Pages are stored rather than hard-coded so that editing the About page is a
 * task for the console, not a deploy.
 */

/** A standalone page ready to render. */
export interface PageView {
  slug: string;
  /** Locale actually rendered, which may differ from the one requested. */
  locale: Locale;
  title: string;
  bodyHtml: string;
  icon: string | null;
  updatedAt: Date;
  isFallback: boolean;
}

/** A page as it appears in the site navigation. */
export interface NavPage {
  slug: string;
  title: string;
  icon: string | null;
  navOrder: number;
}

/**
 * Loads a published page by slug.
 *
 * @param slug URL segment, for example `about`.
 * @param locale Language the reader asked for; falls back to any available
 *     translation so that an untranslated page is still reachable.
 */
export async function getPageBySlug(
  slug: string,
  locale: Locale,
): Promise<PageView | null> {
  const row = await db.page.findFirst({
    where: {slug, status: 'PUBLISHED'},
    select: {
      slug: true,
      icon: true,
      updatedAt: true,
      translations: {select: {locale: true, title: true, bodyHtml: true}},
    },
  });

  if (!row) {
    return null;
  }

  const exact = row.translations.find((item) => item.locale === locale);
  const translation = exact ?? row.translations[0];
  if (!translation) {
    return null;
  }

  return {
    slug: row.slug,
    locale: translation.locale,
    title: translation.title,
    bodyHtml: translation.bodyHtml,
    icon: row.icon,
    updatedAt: row.updatedAt,
    isFallback: !exact,
  };
}

/**
 * Lists pages that should appear in the site navigation.
 *
 * @param locale Language used to resolve page titles.
 */
export async function listNavPages(locale: Locale): Promise<NavPage[]> {
  const rows = await db.page.findMany({
    where: {status: 'PUBLISHED', navOrder: {not: null}},
    orderBy: {navOrder: 'asc'},
    select: {
      slug: true,
      icon: true,
      navOrder: true,
      translations: {select: {locale: true, title: true}},
    },
  });

  const pages: NavPage[] = [];
  for (const row of rows) {
    const translation =
      row.translations.find((item) => item.locale === locale) ??
      row.translations[0];
    if (!translation || row.navOrder === null) {
      continue;
    }
    pages.push({
      slug: row.slug,
      title: translation.title,
      icon: row.icon,
      navOrder: row.navOrder,
    });
  }

  return pages;
}
