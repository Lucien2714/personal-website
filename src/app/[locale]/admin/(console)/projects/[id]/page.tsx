import {notFound} from 'next/navigation';
import {getTranslations, setRequestLocale} from 'next-intl/server';

import {ProjectEditor} from '@/components/admin/ProjectEditor';
import {
  PROJECT_EDITOR_LOCALES,
  type ProjectEditorValue,
} from '@/lib/admin/project-editor-value';
import type {AppLocale} from '@/i18n/routing';
import {db} from '@/lib/db';

/** The "edit project" screen. */

export const dynamic = 'force-dynamic';

/** Renders the editor loaded with a project. */
export default async function EditProjectPage({
  params,
}: {
  params: Promise<{locale: AppLocale; id: string}>;
}) {
  const {locale, id} = await params;
  setRequestLocale(locale);

  const project = await db.project.findUnique({
    where: {id},
    select: {
      id: true,
      slug: true,
      status: true,
      repoUrl: true,
      liveUrl: true,
      embedUrl: true,
      embedHeight: true,
      coverUrl: true,
      techStack: true,
      sortOrder: true,
      featured: true,
      translations: {
        select: {locale: true, name: true, summary: true, bodyMarkdown: true},
      },
    },
  });

  if (!project) {
    notFound();
  }

  const t = await getTranslations('admin');

  const value: ProjectEditorValue = {
    id: project.id,
    slug: project.slug,
    status: project.status as ProjectEditorValue['status'],
    repoUrl: project.repoUrl ?? '',
    liveUrl: project.liveUrl ?? '',
    embedUrl: project.embedUrl ?? '',
    embedHeight: project.embedHeight ? String(project.embedHeight) : '',
    coverUrl: project.coverUrl ?? '',
    techStack: Array.isArray(project.techStack)
      ? project.techStack.filter(
          (item): item is string => typeof item === 'string',
        )
      : [],
    sortOrder: String(project.sortOrder),
    featured: project.featured,
    translations: PROJECT_EDITOR_LOCALES.map((editorLocale) => {
      const existing = project.translations.find(
        (item) => item.locale === editorLocale,
      );
      return {
        locale: editorLocale,
        name: existing?.name ?? '',
        summary: existing?.summary ?? '',
        bodyMarkdown: existing?.bodyMarkdown ?? '',
      };
    }),
  };

  return (
    <div className="space-y-5">
      <h2 className="font-display text-xl font-bold">{t('edit')}</h2>
      <ProjectEditor initialValue={value} locale={locale} />
    </div>
  );
}
