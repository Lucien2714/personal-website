import {getTranslations, setRequestLocale} from 'next-intl/server';

import {PageEditor} from '@/components/admin/PageEditor';
import {emptyPageValue} from '@/lib/admin/page-editor-value';
import type {AppLocale} from '@/i18n/routing';

/** The "new standalone page" screen. */

export const dynamic = 'force-dynamic';

/** Renders an empty page editor. */
export default async function NewStandalonePage({
  params,
}: {
  params: Promise<{locale: AppLocale}>;
}) {
  const {locale} = await params;
  setRequestLocale(locale);

  const t = await getTranslations('admin');

  return (
    <div className="space-y-5">
      <h2 className="font-display text-xl font-bold">{t('pages')}</h2>
      <PageEditor initialValue={emptyPageValue()} locale={locale} />
    </div>
  );
}
