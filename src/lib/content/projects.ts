import type {Locale} from '@/generated/prisma/enums';
import type {Prisma} from '@/generated/prisma/client';
import {db} from '@/lib/db';

/**
 * Read-side queries for the projects section.
 *
 * A project entry is both a portfolio card and the mounting point for an
 * embedded application: when `embedUrl` is set, the project page renders that
 * URL inside a sandboxed iframe. That is the seam through which your other
 * projects appear on this site without either code base depending on the
 * other.
 */

/** A project as rendered in a list or on its own page. */
export interface ProjectView {
  id: string;
  slug: string;
  name: string;
  summary: string;
  bodyHtml: string | null;
  repoUrl: string | null;
  liveUrl: string | null;
  embedUrl: string | null;
  embedHeight: number | null;
  coverUrl: string | null;
  techStack: string[];
  featured: boolean;
  isFallback: boolean;
}

/** Visibility filter shared by every public project query. */
function publicProjectFilter(): Prisma.ProjectWhereInput {
  return {status: 'PUBLISHED'};
}

/** Normalises the `techStack` JSON column into a string array. */
function toTechStack(value: Prisma.JsonValue): string[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return value.filter((item): item is string => typeof item === 'string');
}

/** Row shape shared by the list and detail queries. */
interface ProjectRow {
  id: string;
  slug: string;
  repoUrl: string | null;
  liveUrl: string | null;
  embedUrl: string | null;
  embedHeight: number | null;
  coverUrl: string | null;
  techStack: Prisma.JsonValue;
  featured: boolean;
  translations: Array<{
    locale: Locale;
    name: string;
    summary: string;
    bodyHtml: string | null;
  }>;
}

/** Selects the requested translation, falling back to any other language. */
function toProjectView(row: ProjectRow, locale: Locale): ProjectView | null {
  const exact = row.translations.find((item) => item.locale === locale);
  const translation = exact ?? row.translations[0];
  if (!translation) {
    return null;
  }

  return {
    id: row.id,
    slug: row.slug,
    name: translation.name,
    summary: translation.summary,
    bodyHtml: translation.bodyHtml,
    repoUrl: row.repoUrl,
    liveUrl: row.liveUrl,
    embedUrl: row.embedUrl,
    embedHeight: row.embedHeight,
    coverUrl: row.coverUrl,
    techStack: toTechStack(row.techStack),
    featured: row.featured,
    isFallback: !exact,
  };
}

const projectSelect = {
  id: true,
  slug: true,
  repoUrl: true,
  liveUrl: true,
  embedUrl: true,
  embedHeight: true,
  coverUrl: true,
  techStack: true,
  featured: true,
  translations: {
    select: {locale: true, name: true, summary: true, bodyHtml: true},
  },
} as const;

/**
 * Lists published projects, featured first, then by explicit sort order.
 *
 * @param locale Language used to resolve names and summaries.
 * @param options.featuredOnly Restrict the result to featured projects.
 * @param options.limit Maximum number of projects to return.
 */
export async function listProjects(
  locale: Locale,
  options: {featuredOnly?: boolean; limit?: number} = {},
): Promise<ProjectView[]> {
  const rows = await db.project.findMany({
    where: {
      ...publicProjectFilter(),
      ...(options.featuredOnly ? {featured: true} : {}),
    },
    orderBy: [{featured: 'desc'}, {sortOrder: 'asc'}, {createdAt: 'desc'}],
    ...(options.limit ? {take: options.limit} : {}),
    select: projectSelect,
  });

  return rows
    .map((row) => toProjectView(row, locale))
    .filter((project): project is ProjectView => project !== null);
}

/**
 * Loads one published project by slug.
 *
 * @param slug URL segment of the project.
 * @param locale Language used to resolve the name, summary and body.
 */
export async function getProjectBySlug(
  slug: string,
  locale: Locale,
): Promise<ProjectView | null> {
  const row = await db.project.findFirst({
    where: {...publicProjectFilter(), slug},
    select: projectSelect,
  });

  return row ? toProjectView(row, locale) : null;
}

export {publicProjectFilter};
