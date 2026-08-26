import {getTranslations, setRequestLocale} from 'next-intl/server';

import {deleteMomentAction} from '@/app/[locale]/admin/(console)/moments/actions';
import {DeleteButton} from '@/components/admin/DeleteButton';
import {MomentComposer} from '@/components/admin/MomentComposer';
import {MomentCard} from '@/components/moment/MomentCard';
import type {AppLocale} from '@/i18n/routing';
import {listMoments} from '@/lib/content/moments';

/** The moments section: compose at the top, manage the stream below. */

export const dynamic = 'force-dynamic';

/** Renders the composer and the recent stream. */
export default async function AdminMomentsPage({
  params,
}: {
  params: Promise<{locale: AppLocale}>;
}) {
  const {locale} = await params;
  setRequestLocale(locale);

  const [t, moments] = await Promise.all([
    getTranslations('admin'),
    listMoments({perPage: 30}),
  ]);

  return (
    <div className="space-y-5">
      <h2 className="font-display text-xl font-bold">{t('moments')}</h2>

      <MomentComposer />

      {moments.items.length === 0 ? (
        <p className="card p-8 text-center text-sm text-[var(--color-ink-muted)]">
          {t('empty')}
        </p>
      ) : (
        <ul className="space-y-3">
          {moments.items.map((moment) => (
            <li key={moment.id} className="relative">
              <MomentCard moment={moment} />
              <div className="absolute right-4 top-4">
                <DeleteButton id={moment.id} action={deleteMomentAction} />
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
