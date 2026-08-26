import {getTranslations, setRequestLocale} from 'next-intl/server';

import {listTaxonomySuggestionsAction} from '@/app/[locale]/admin/(console)/posts/actions';
import {PostEditor} from '@/components/admin/PostEditor';
import {type AppLocale, toPrismaLocale} from '@/i18n/routing';
import {emptyEditorValue} from '@/lib/admin/editor-value';

/** The "write a new post" screen. */

export const dynamic = 'force-dynamic';

/** Renders an empty editor. */
export default async function NewPostPage({
  params,
}: {
  params: Promise<{locale: AppLocale}>;
}) {
  const {locale} = await params;
  setRequestLocale(locale);

  const [t, suggestions] = await Promise.all([
    getTranslations('admin'),
    listTaxonomySuggestionsAction(toPrismaLocale(locale)),
  ]);

  return (
    <div className="space-y-5">
      <h2 className="font-display text-xl font-bold">{t('newPost')}</h2>
      <PostEditor
        initialValue={emptyEditorValue()}
        suggestions={suggestions}
        locale={locale}
      />
    </div>
  );
}
