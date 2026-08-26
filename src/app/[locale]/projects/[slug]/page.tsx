import type {Metadata} from 'next';
import Image from 'next/image';
import {notFound} from 'next/navigation';
import {getTranslations, setRequestLocale} from 'next-intl/server';

import {CommentSection} from '@/components/comment/CommentSection';
import {ProjectEmbed} from '@/components/project/ProjectEmbed';
import {Chip, Container} from '@/components/ui/primitives';
import {Link} from '@/i18n/navigation';
import {type AppLocale, toPrismaLocale} from '@/i18n/routing';
import {getProjectBySlug} from '@/lib/content/projects';

/** A single project, including its live embed when one is configured. */

export const dynamic = 'force-dynamic';

/** Builds the page metadata for the active locale. */
export async function generateMetadata({
  params,
}: {
  params: Promise<{locale: AppLocale; slug: string}>;
}): Promise<Metadata> {
  const {locale, slug} = await params;
  const project = await getProjectBySlug(slug, toPrismaLocale(locale));

  if (!project) {
    return {title: 'Not found'};
  }

  return {
    title: project.name,
    description: project.summary,
    alternates: {canonical: `/${locale}/projects/${project.slug}`},
  };
}

/** Renders one project. */
export default async function ProjectPage({
  params,
}: {
  params: Promise<{locale: AppLocale; slug: string}>;
}) {
  const {locale, slug} = await params;
  setRequestLocale(locale);

  const project = await getProjectBySlug(slug, toPrismaLocale(locale));
  if (!project) {
    notFound();
  }

  const t = await getTranslations('projects');

  return (
    <Container size="wide" className="pb-16 pt-10 sm:pt-14">
      <Link
        href="/projects"
        className="text-sm text-[var(--color-accent)] underline-offset-4 hover:underline"
      >
        ← {t('title')}
      </Link>

      <header className="mt-4">
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="font-display text-3xl font-bold sm:text-4xl">
            {project.name}
          </h1>
          {project.featured && <Chip tone="violet">{t('featured')}</Chip>}
        </div>

        <p className="mt-3 max-w-2xl text-[var(--color-ink-muted)]">
          {project.summary}
        </p>

        {project.techStack.length > 0 && (
          <div className="mt-4 flex flex-wrap gap-1.5">
            {project.techStack.map((tech) => (
              <Chip key={tech} tone="neutral">
                {tech}
              </Chip>
            ))}
          </div>
        )}

        <div className="mt-5 flex flex-wrap gap-3">
          {project.liveUrl && (
            <a
              href={project.liveUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="rounded-lg bg-[var(--color-accent)] px-5 py-2 text-sm font-semibold text-[var(--color-on-accent)] transition hover:opacity-90"
            >
              {t('liveDemo')} ↗
            </a>
          )}
          {project.repoUrl && (
            <a
              href={project.repoUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="rounded-lg border border-[var(--color-border)] px-5 py-2 text-sm font-semibold transition hover:border-[var(--color-accent)] hover:text-[var(--color-accent)]"
            >
              {t('sourceCode')} ↗
            </a>
          )}
        </div>
      </header>

      {project.coverUrl && !project.embedUrl && (
        <div className="relative mt-8 aspect-[2/1] w-full overflow-hidden rounded-2xl">
          <Image
            src={project.coverUrl}
            alt=""
            fill
            sizes="(max-width: 1024px) 100vw, 960px"
            className="object-cover"
            priority
          />
        </div>
      )}

      {project.embedUrl && (
        <ProjectEmbed
          url={project.embedUrl}
          name={project.name}
          height={project.embedHeight}
        />
      )}

      {project.bodyHtml && (
        // Sanitised at save time by src/lib/content/markdown.ts.
        <div
          className="prose-anime mt-8 max-w-3xl"
          dangerouslySetInnerHTML={{__html: project.bodyHtml}}
        />
      )}

      <div className="max-w-3xl">
        <CommentSection
          target={{type: 'project', id: project.id}}
          returnTo={`/${locale}/projects/${project.slug}`}
        />
      </div>
    </Container>
  );
}
