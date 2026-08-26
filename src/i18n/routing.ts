import {defineRouting} from 'next-intl/routing';

import {Locale as PrismaLocale} from '@/generated/prisma/enums';

/**
 * Locale configuration shared by the router, the middleware and the database
 * layer.
 *
 * Two representations of a language exist in this code base: the lower-case
 * URL segment (`/zh/posts`) and the Prisma enum (`Locale.ZH`). Keeping the
 * conversion in one place stops the two drifting apart.
 */

/** Locales the site is served in, in navigation order. */
export const locales = ['en', 'zh'] as const;

/** A locale as it appears in a URL. */
export type AppLocale = (typeof locales)[number];

/** Locale used when a visitor expresses no preference. */
export const defaultLocale: AppLocale = 'en';

/** Human-readable, self-referential language names for the switcher. */
export const localeLabels: Record<AppLocale, string> = {
  en: 'English',
  zh: '中文',
};

/** next-intl routing definition consumed by the middleware and navigation. */
export const routing = defineRouting({
  locales,
  defaultLocale,
  // Every locale carries its prefix, including the default one. A single
  // canonical URL per language avoids duplicate content in search results and
  // makes the language switcher a plain path rewrite.
  localePrefix: 'always',
});

/** Maps a URL locale onto the database enum. */
export function toPrismaLocale(locale: AppLocale): PrismaLocale {
  return locale === 'zh' ? PrismaLocale.ZH : PrismaLocale.EN;
}

/** Maps a database enum value onto the URL locale. */
export function toAppLocale(locale: PrismaLocale): AppLocale {
  return locale === PrismaLocale.ZH ? 'zh' : 'en';
}

/** Narrows an arbitrary string to a supported locale. */
export function isAppLocale(value: string): value is AppLocale {
  return (locales as readonly string[]).includes(value);
}
