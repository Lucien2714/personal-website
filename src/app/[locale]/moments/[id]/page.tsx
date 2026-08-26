import type {Metadata} from 'next';
import {notFound} from 'next/navigation';
import {getTranslations, setRequestLocale} from 'next-intl/server';

import {CommentSection} from '@/components/comment/CommentSection';
import {MomentCard} from '@/components/moment/MomentCard';
import {Container} from '@/components/ui/primitives';
import {Link} from '@/i18n/navigation';
import type {AppLocale} from '@/i18n/routing';
import {getMomentById} from '@/lib/content/moments';

/**
 * One moment and its conversation.
 *
 * Moments are short enough that this page is mostly the comment thread. It
 * exists so that a discussion has a stable URL and so the stream itself stays
 * a stream rather than becoming a column of open comment boxes.
 */

export const dynamic = 'force-dynamic';

/** Builds the page metadata for the active locale. */
export async function generateMetadata({
  params,
}: {
  params: Promise<{locale: AppLocale; id: string}>;
}): Promise<Metadata> {
  const {locale, id} = await params;
  const moment = await getMomentById(id);

  if (!moment) {
    return {title: 'Not found'};
  }

  // A moment has no title, so the opening words stand in for one.
  const excerpt = moment.body.slice(0, 60).trim();

  return {
    title: excerpt.length < moment.body.length ? `${excerpt}…` : excerpt,
    description: moment.body.slice(0, 200),
    alternates: {canonical: `/${locale}/moments/${moment.id}`},
  };
}

/** Renders one moment with its comments. */
export default async function MomentPage({
  params,
}: {
  params: Promise<{locale: AppLocale; id: string}>;
}) {
  const {locale, id} = await params;
  setRequestLocale(locale);

  const moment = await getMomentById(id);
  if (!moment) {
    notFound();
  }

  const t = await getTranslations('moments');

  return (
    <Container className="pb-16 pt-10 sm:pt-14">
      <Link
        href="/moments"
        className="text-sm text-[var(--color-accent)] underline-offset-4 hover:underline"
      >
        ← {t('title')}
      </Link>

      <div className="mt-4">
        <MomentCard moment={moment} />
      </div>

      <CommentSection
        target={{type: 'moment', id: moment.id}}
        publishedAt={moment.createdAt}
        returnTo={`/${locale}/moments/${moment.id}`}
      />
    </Container>
  );
}
