import Image from 'next/image';
import {useTranslations} from 'next-intl';

import {Chip} from '@/components/ui/primitives';
import {Link} from '@/i18n/navigation';
import type {ProjectView} from '@/lib/content/projects';

/**
 * One project in the portfolio grid.
 *
 * External links (source, live demo) sit outside the card-wide link so that
 * they remain individually clickable; the stretched-link trick used by
 * {@link PostCard} would swallow them.
 */
export function ProjectCard({project}: {project: ProjectView}) {
  const t = useTranslations('projects');

  return (
    <article className="card card-interactive flex flex-col overflow-hidden">
      {project.coverUrl && (
        <div className="relative aspect-[16/9] w-full overflow-hidden">
          <Image
            src={project.coverUrl}
            alt=""
            fill
            sizes="(max-width: 768px) 100vw, 380px"
            className="object-cover"
          />
        </div>
      )}

      <div className="flex flex-1 flex-col p-5">
        <div className="mb-2 flex items-center gap-2">
          <h3 className="font-display text-lg font-bold">
            <Link
              href={`/projects/${project.slug}`}
              className="transition hover:text-[var(--color-sakura)]"
            >
              {project.name}
            </Link>
          </h3>
          {project.featured && <Chip tone="lavender">{t('featured')}</Chip>}
        </div>

        <p className="flex-1 text-sm leading-relaxed text-[var(--color-ink-muted)]">
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

        {(project.repoUrl ?? project.liveUrl) && (
          <div className="mt-4 flex flex-wrap gap-4 text-sm font-medium">
            {project.repoUrl && (
              <a
                href={project.repoUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-[var(--color-ink-muted)] transition hover:text-[var(--color-sakura)]"
              >
                {t('sourceCode')} ↗
              </a>
            )}
            {project.liveUrl && (
              <a
                href={project.liveUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-[var(--color-sakura)] transition hover:text-[var(--color-lavender)]"
              >
                {t('liveDemo')} ↗
              </a>
            )}
          </div>
        )}
      </div>
    </article>
  );
}
