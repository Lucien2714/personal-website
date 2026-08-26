import {getTranslations, setRequestLocale} from 'next-intl/server';

import {SettingsForm} from '@/components/admin/SettingsForm';
import type {AppLocale} from '@/i18n/routing';
import {getSiteSettings} from '@/lib/content/settings';

/** The site settings screen. */

export const dynamic = 'force-dynamic';

/** Renders the settings form. */
export default async function AdminSettingsPage({
  params,
}: {
  params: Promise<{locale: AppLocale}>;
}) {
  const {locale} = await params;
  setRequestLocale(locale);

  const [t, settings] = await Promise.all([
    getTranslations('admin'),
    getSiteSettings(),
  ]);

  return (
    <div className="space-y-5">
      <h2 className="font-display text-xl font-bold">{t('settings')}</h2>
      <SettingsForm initial={settings} />
    </div>
  );
}
