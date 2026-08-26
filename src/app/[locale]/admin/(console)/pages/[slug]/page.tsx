import {notFound} from 'next/navigation';
import {getTranslations, setRequestLocale} from 'next-intl/server';

import {PageEditor} from '@/components/admin/PageEditor';
import {
  PAGE_EDITOR_LOCALES,
  type PageEditorValue,
} from '@/lib/admin/page-editor-value';
import {Link} from '@/i18n/navigation';
import type {AppLocale} from '@/i18n/routing';
import {db} from '@/lib/db';

/** The "edit standalone page" screen. */

export const dynamic = 'force-dynamic';

/** Renders the editor loaded with a page. */
export default async function EditStandalonePage({
  params,
}: {
  params: Promise<{locale: AppLocale; slug: string}>;
}) {
  const {locale, slug} = await params;
  setRequestLocale(locale);

  const page = await db.page.findUnique({
    where: {slug},
    select: {
      slug: true,
      status: true,
      navOrder: true,
      icon: true,
      translations: {select: {locale: true, title: true, bodyMarkdown: true}},
    },
  });

  if (!page) {
    notFound();
  }

  const t = await getTranslations('admin');

  const value: PageEditorValue = {
    originalSlug: page.slug,
    slug: page.slug,
    status: page.status as PageEditorValue['status'],
    navOrder: page.navOrder === null ? '' : String(page.navOrder),
    icon: page.icon ?? '',
    translations: PAGE_EDITOR_LOCALES.map((editorLocale) => {
      const existing = page.translations.find(
        (item) => item.locale === editorLocale,
      );
      return {
        locale: editorLocale,
        title: existing?.title ?? '',
        bodyMarkdown: existing?.bodyMarkdown ?? '',
      };
    }),
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="font-display text-xl font-bold">{t('edit')}</h2>
        {page.status === 'PUBLISHED' && (
          <Link
            href={`/${page.slug}`}
            className="text-sm text-[var(--color-accent)] underline-offset-4 hover:underline"
          >
            {t('preview')} ↗
          </Link>
        )}
      </div>

      <PageEditor initialValue={value} locale={locale} />
    </div>
  );
}
