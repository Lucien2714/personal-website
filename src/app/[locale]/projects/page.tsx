import type {Metadata} from 'next';
import {getTranslations, setRequestLocale} from 'next-intl/server';

import {ProjectCard} from '@/components/project/ProjectCard';
import {Container, EmptyState, PageHeader} from '@/components/ui/primitives';
import {type AppLocale, toPrismaLocale} from '@/i18n/routing';
import {listProjects} from '@/lib/content/projects';

/** The projects index. */

export const dynamic = 'force-dynamic';

/** Builds the page metadata for the active locale. */
export async function generateMetadata({
  params,
}: {
  params: Promise<{locale: AppLocale}>;
}): Promise<Metadata> {
  const {locale} = await params;
  const t = await getTranslations({locale, namespace: 'projects'});
  return {title: t('title'), description: t('subtitle')};
}

/** Renders every published project. */
export default async function ProjectsPage({
  params,
}: {
  params: Promise<{locale: AppLocale}>;
}) {
  const {locale} = await params;
  setRequestLocale(locale);

  const [t, projects] = await Promise.all([
    getTranslations('projects'),
    listProjects(toPrismaLocale(locale)),
  ]);

  return (
    <Container size="wide" className="pb-16">
      <PageHeader title={t('title')} subtitle={t('subtitle')} />

      {projects.length > 0 ? (
        <div className="grid gap-5 sm:grid-cols-2">
          {projects.map((project) => (
            <ProjectCard key={project.id} project={project} />
          ))}
        </div>
      ) : (
        <EmptyState message={t('empty')} />
      )}
    </Container>
  );
}
