import {getTranslations, setRequestLocale} from 'next-intl/server';

import {ProjectEditor} from '@/components/admin/ProjectEditor';
import {emptyProjectValue} from '@/lib/admin/project-editor-value';
import type {AppLocale} from '@/i18n/routing';

/** The "new project" screen. */

export const dynamic = 'force-dynamic';

/** Renders an empty project editor. */
export default async function NewProjectPage({
  params,
}: {
  params: Promise<{locale: AppLocale}>;
}) {
  const {locale} = await params;
  setRequestLocale(locale);

  const t = await getTranslations('admin');

  return (
    <div className="space-y-5">
      <h2 className="font-display text-xl font-bold">{t('newProject')}</h2>
      <ProjectEditor initialValue={emptyProjectValue()} locale={locale} />
    </div>
  );
}
