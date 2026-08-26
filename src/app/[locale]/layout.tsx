import type {Metadata} from 'next';
import {Inter, Space_Grotesk} from 'next/font/google';
import {cookies} from 'next/headers';
import {NextIntlClientProvider, hasLocale} from 'next-intl';
import {getTranslations, setRequestLocale} from 'next-intl/server';
import {notFound} from 'next/navigation';
import type {ReactNode} from 'react';

import '@/styles/globals.css';

import {GridBackdrop} from '@/components/decor/GridBackdrop';
import {SiteFooter} from '@/components/layout/SiteFooter';
import {SiteHeader} from '@/components/layout/SiteHeader';
import {type AppLocale, routing, toPrismaLocale} from '@/i18n/routing';
import {listNavPages} from '@/lib/content/pages';
import {getSiteSettings} from '@/lib/content/settings';
import {env} from '@/lib/env';
import {THEME_COOKIE_NAME, isExplicitTheme} from '@/lib/theme';

/**
 * The root layout for every localised route.
 *
 * This is the outermost layout in the application: `<html>` lives here rather
 * than in `app/layout.tsx` because the `lang` attribute depends on the locale
 * segment, and that segment is only known inside `[locale]`.
 */

/**
 * Display face, used for headings and the wordmark.
 *
 * Space Grotesk is a geometric grotesque with slightly mechanical detailing -
 * it reads as technical rather than soft, which is the register the rest of
 * the palette aims for.
 */
const spaceGrotesk = Space_Grotesk({
  subsets: ['latin'],
  weight: ['500', '600', '700'],
  variable: '--font-space-grotesk',
  display: 'swap',
});

/** Text face for body copy. CJK falls through to the system stack. */
const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
  display: 'swap',
});

/** Pre-renders the shell for both locales at build time. */
export function generateStaticParams(): Array<{locale: AppLocale}> {
  return routing.locales.map((locale) => ({locale}));
}

/** Builds the document-level metadata for the active locale. */
export async function generateMetadata({
  params,
}: {
  params: Promise<{locale: string}>;
}): Promise<Metadata> {
  const {locale} = await params;
  const t = await getTranslations({locale, namespace: 'site'});

  return {
    metadataBase: new URL(env.NEXT_PUBLIC_SITE_URL),
    title: {
      default: t('title'),
      // Page titles read "Post title · Lucien's Corner".
      template: `%s · ${t('title')}`,
    },
    description: t('description'),
    alternates: {
      canonical: `/${locale}`,
      languages: Object.fromEntries(
        routing.locales.map((item) => [item, `/${item}`]),
      ),
      types: {'application/rss+xml': '/feed.xml'},
    },
    openGraph: {
      type: 'website',
      siteName: t('title'),
      title: t('title'),
      description: t('description'),
      locale: locale === 'zh' ? 'zh_CN' : 'en_US',
    },
    twitter: {card: 'summary_large_image'},
    icons: {
      // The source SVG favicon from the old blog was a 2.7 MB embedded raster,
      // so the small raster variants are used instead.
      icon: [
        {url: '/favicon.ico', sizes: '48x48'},
        {url: '/favicon-96x96.png', type: 'image/png', sizes: '96x96'},
      ],
      shortcut: '/favicon.ico',
      apple: '/apple-touch-icon.png',
    },
    manifest: '/site.webmanifest',
  };
}

/** Renders the document shell shared by every page. */
export default async function LocaleLayout({
  children,
  params,
}: {
  children: ReactNode;
  params: Promise<{locale: string}>;
}) {
  const {locale} = await params;

  if (!hasLocale(routing.locales, locale)) {
    notFound();
  }

  // Marks the locale as known for this request so that child server
  // components can be statically rendered where they have no data needs.
  setRequestLocale(locale);

  const [settings, navPages, t, cookieStore] = await Promise.all([
    getSiteSettings(),
    listNavPages(toPrismaLocale(locale)),
    getTranslations({locale, namespace: 'site'}),
    cookies(),
  ]);

  // Applying the stored theme here, in the first byte of HTML, is what makes a
  // blocking inline script unnecessary: there is no moment at which the page
  // is painted in the wrong theme. An absent cookie means "follow the OS",
  // which the CSS media query already handles.
  const storedTheme = cookieStore.get(THEME_COOKIE_NAME)?.value;

  return (
    <html
      lang={locale}
      className={`${spaceGrotesk.variable} ${inter.variable}`}
      {...(isExplicitTheme(storedTheme) ? {'data-theme': storedTheme} : {})}
    >
      <body className="flex min-h-dvh flex-col">
        <NextIntlClientProvider>
          <GridBackdrop />

          {/* Keyboard users can jump straight past the navigation. */}
          <a
            href="#main"
            className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-lg focus:bg-[var(--color-accent)] focus:px-4 focus:py-2 focus:text-[var(--color-on-accent)]"
          >
            Skip to content
          </a>

          <SiteHeader
            siteTitle={t('title')}
            avatarUrl={settings.avatarUrl}
            extraItems={navPages.map((page) => ({
              href: `/${page.slug}`,
              label: page.title,
            }))}
          />

          <main id="main" className="flex-1">
            {children}
          </main>

          <SiteFooter />
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
