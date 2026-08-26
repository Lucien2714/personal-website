import type {Metadata} from 'next';
import {getTranslations, setRequestLocale} from 'next-intl/server';

import {MomentCard} from '@/components/moment/MomentCard';
import {Pagination} from '@/components/ui/Pagination';
import {Container, EmptyState, PageHeader} from '@/components/ui/primitives';
import type {AppLocale} from '@/i18n/routing';
import {listMoments} from '@/lib/content/moments';

/** The moments stream: short, dated notes in reverse chronological order. */

export const dynamic = 'force-dynamic';

/** Builds the page metadata for the active locale. */
export async function generateMetadata({
  params,
}: {
  params: Promise<{locale: AppLocale}>;
}): Promise<Metadata> {
  const {locale} = await params;
  const t = await getTranslations({locale, namespace: 'moments'});
  return {title: t('title'), description: t('subtitle')};
}

/** Renders a page of moments. */
export default async function MomentsPage({
  params,
  searchParams,
}: {
  params: Promise<{locale: AppLocale}>;
  searchParams: Promise<{page?: string}>;
}) {
  const [{locale}, query] = await Promise.all([params, searchParams]);
  setRequestLocale(locale);

  const page = Number.parseInt(query.page ?? '1', 10) || 1;
  const [t, result] = await Promise.all([
    getTranslations('moments'),
    listMoments({page}),
  ]);

  return (
    <Container className="pb-16">
      <PageHeader title={t('title')} subtitle={t('subtitle')} />

      {result.items.length > 0 ? (
        <div className="grid gap-4">
          {result.items.map((moment) => (
            <MomentCard key={moment.id} moment={moment} />
          ))}
        </div>
      ) : (
        <EmptyState message={t('empty')} />
      )}

      <Pagination
        page={result.page}
        totalPages={result.totalPages}
        basePath="/moments"
      />
    </Container>
  );
}
