import {notFound} from 'next/navigation';
import {getTranslations, setRequestLocale} from 'next-intl/server';

import {listTaxonomySuggestionsAction} from '@/app/[locale]/admin/(console)/posts/actions';
import {PostEditor} from '@/components/admin/PostEditor';
import {Link} from '@/i18n/navigation';
import {type AppLocale, toPrismaLocale} from '@/i18n/routing';
import {toEditorValue} from '@/lib/admin/editor-value';
import {db} from '@/lib/db';

/** The "edit an existing post" screen. */

export const dynamic = 'force-dynamic';

/** Renders the editor loaded with a post. */
export default async function EditPostPage({
  params,
}: {
  params: Promise<{locale: AppLocale; id: string}>;
}) {
  const {locale, id} = await params;
  setRequestLocale(locale);

  const post = await db.post.findFirst({
    where: {id, deletedAt: null},
    select: {
      id: true,
      status: true,
      publishedAt: true,
      pinned: true,
      coverUrl: true,
      categories: {select: {names: true}},
      tags: {select: {names: true}},
      translations: {
        select: {
          locale: true,
          title: true,
          slug: true,
          description: true,
          bodyMarkdown: true,
        },
      },
    },
  });

  if (!post) {
    notFound();
  }

  const [t, suggestions] = await Promise.all([
    getTranslations('admin'),
    listTaxonomySuggestionsAction(toPrismaLocale(locale)),
  ]);

  // Offers a link to the live page, but only for something a reader could
  // actually open.
  const publicSlug =
    post.status === 'PUBLISHED'
      ? (post.translations.find(
          (item) => item.locale === toPrismaLocale(locale),
        )?.slug ?? post.translations[0]?.slug)
      : undefined;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="font-display text-xl font-bold">{t('edit')}</h2>
        {publicSlug && (
          <Link
            href={`/posts/${publicSlug}`}
            className="text-sm text-[var(--color-sakura)] underline-offset-4 hover:underline"
          >
            {t('preview')} ↗
          </Link>
        )}
      </div>

      <PostEditor
        initialValue={toEditorValue(post)}
        suggestions={suggestions}
        locale={locale}
      />
    </div>
  );
}
