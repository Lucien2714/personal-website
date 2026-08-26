import type {Prisma} from '@/generated/prisma/client';
import type {Locale, PublishStatus} from '@/generated/prisma/enums';
import {db} from '@/lib/db';
import {renderMarkdown} from '@/lib/content/markdown';
import {slugify, uniqueSlug} from '@/lib/utils/slug';

/**
 * The write side of content management.
 *
 * Three callers need to create and update content: the admin console, the
 * authenticated half of the public API, and the Jekyll import script. Putting
 * the logic here means all three produce identical rows - same slug rules,
 * same rendered HTML, same reading-time estimate - and that adding a rule
 * later takes one edit rather than three.
 */

/** One language rendition supplied by a caller. */
export interface TranslationInput {
  locale: Locale;
  title: string;
  /** Omitted or empty means "derive from the title". */
  slug?: string;
  description?: string | null;
  bodyMarkdown: string;
}

/** Everything needed to create or update a post. */
export interface PostInput {
  /** Present when updating, absent when creating. */
  id?: string;
  authorId: string;
  status?: PublishStatus;
  publishedAt?: Date | null;
  pinned?: boolean;
  coverUrl?: string | null;
  /** Category slugs. Missing categories are created on the fly. */
  categories?: string[];
  /** Tag slugs. Missing tags are created on the fly. */
  tags?: string[];
  translations: TranslationInput[];
}

/**
 * Ensures a taxonomy term exists and returns its id.
 *
 * Auto-creating terms is what makes the import script and the API pleasant to
 * use: a caller supplies human names and does not have to manage a separate
 * taxonomy table first.
 *
 * @param kind Which taxonomy to touch.
 * @param name Display name; also the source of the slug.
 * @param locale Language the supplied name is written in.
 */
async function ensureTaxonomy(
  kind: 'category' | 'tag',
  name: string,
  locale: Locale,
): Promise<string> {
  const slug = slugify(name);
  const names = {[locale]: name} as Record<string, string>;

  if (kind === 'category') {
    const existing = await db.category.findUnique({where: {slug}});
    if (existing) {
      // Merge the new language in without discarding the other one.
      const merged = {
        ...(existing.names as Record<string, string>),
        ...names,
      };
      await db.category.update({where: {slug}, data: {names: merged}});
      return existing.id;
    }
    const created = await db.category.create({data: {slug, names}});
    return created.id;
  }

  const existing = await db.tag.findUnique({where: {slug}});
  if (existing) {
    const merged = {...(existing.names as Record<string, string>), ...names};
    await db.tag.update({where: {slug}, data: {names: merged}});
    return existing.id;
  }
  const created = await db.tag.create({data: {slug, names}});
  return created.id;
}

/**
 * Resolves a slug for a translation, guaranteeing uniqueness within its locale.
 *
 * @param input The translation being saved.
 * @param excludePostId Post whose own slug should not count as a collision,
 *     so that re-saving an unchanged post keeps its URL.
 */
async function resolveSlug(
  input: TranslationInput,
  excludePostId?: string,
): Promise<string> {
  const desired = slugify(input.slug?.trim() || input.title);

  return uniqueSlug(desired, async (candidate) => {
    const clash = await db.postTranslation.findUnique({
      where: {locale_slug: {locale: input.locale, slug: candidate}},
      select: {postId: true},
    });
    return clash !== null && clash.postId !== excludePostId;
  });
}

/**
 * Creates or updates a post together with all of its translations.
 *
 * Runs inside a transaction: a post whose English translation saved but whose
 * Chinese one failed would be worse than no save at all.
 *
 * @param input The post and its translations.
 * @returns The post id.
 */
export async function savePost(input: PostInput): Promise<string> {
  if (input.translations.length === 0) {
    throw new Error('A post needs at least one translation.');
  }

  // Markdown rendering and taxonomy upserts happen before the transaction:
  // both are slow, and holding a database transaction open across them would
  // lengthen lock windows for no benefit.
  const rendered = await Promise.all(
    input.translations.map(async (translation) => ({
      input: translation,
      slug: await resolveSlug(translation, input.id),
      result: await renderMarkdown(translation.bodyMarkdown),
    })),
  );

  const primaryLocale = input.translations[0]?.locale ?? 'EN';
  const categoryIds = await Promise.all(
    (input.categories ?? []).map((name) =>
      ensureTaxonomy('category', name, primaryLocale),
    ),
  );
  const tagIds = await Promise.all(
    (input.tags ?? []).map((name) =>
      ensureTaxonomy('tag', name, primaryLocale),
    ),
  );

  const status = input.status ?? 'DRAFT';
  // Publishing without an explicit timestamp means "now".
  const publishedAt =
    input.publishedAt ?? (status === 'PUBLISHED' ? new Date() : null);

  return db.$transaction(async (tx) => {
    const post = input.id
      ? await tx.post.update({
          where: {id: input.id},
          data: {
            status,
            publishedAt,
            pinned: input.pinned ?? false,
            coverUrl: input.coverUrl ?? null,
            categories: {set: categoryIds.map((id) => ({id}))},
            tags: {set: tagIds.map((id) => ({id}))},
          },
        })
      : await tx.post.create({
          data: {
            authorId: input.authorId,
            status,
            publishedAt,
            pinned: input.pinned ?? false,
            coverUrl: input.coverUrl ?? null,
            categories: {connect: categoryIds.map((id) => ({id}))},
            tags: {connect: tagIds.map((id) => ({id}))},
          },
        });

    for (const item of rendered) {
      const data = {
        slug: item.slug,
        title: item.input.title,
        description:
          item.input.description?.trim() || item.result.excerpt || null,
        bodyMarkdown: item.input.bodyMarkdown,
        bodyHtml: item.result.html,
        // Prisma types JSON columns as index-signature objects, which a
        // declared interface does not structurally satisfy even though the
        // values are plain JSON. The cast is at the storage boundary only.
        tableOfContents: item.result.toc as unknown as Prisma.InputJsonValue,
        readingMinutes: item.result.readingMinutes,
      };

      await tx.postTranslation.upsert({
        where: {postId_locale: {postId: post.id, locale: item.input.locale}},
        create: {postId: post.id, locale: item.input.locale, ...data},
        update: data,
      });
    }

    // Translations the caller no longer supplies are removed, so deleting the
    // Chinese version in the console actually deletes it.
    const keptLocales = input.translations.map((item) => item.locale);
    await tx.postTranslation.deleteMany({
      where: {postId: post.id, locale: {notIn: keptLocales}},
    });

    return post.id;
  });
}

/**
 * Soft-deletes a post.
 *
 * @param id Post identifier.
 */
export async function softDeletePost(id: string): Promise<void> {
  await db.post.update({
    where: {id},
    data: {deletedAt: new Date(), status: 'ARCHIVED'},
  });
}

/** Everything needed to create or update a moment. */
export interface MomentInput {
  id?: string;
  authorId: string;
  body: string;
  images?: string[];
  mood?: string | null;
  location?: string | null;
  status?: PublishStatus;
  createdAt?: Date;
}

/**
 * Creates or updates a moment.
 *
 * @param input The moment content.
 * @returns The moment id.
 */
export async function saveMoment(input: MomentInput): Promise<string> {
  const data = {
    body: input.body,
    images: input.images ?? [],
    mood: input.mood ?? null,
    location: input.location ?? null,
    status: input.status ?? 'PUBLISHED',
  };

  if (input.id) {
    const updated = await db.moment.update({where: {id: input.id}, data});
    return updated.id;
  }

  const created = await db.moment.create({
    data: {
      ...data,
      authorId: input.authorId,
      ...(input.createdAt ? {createdAt: input.createdAt} : {}),
    },
  });
  return created.id;
}

/** Everything needed to create or update a project. */
export interface ProjectInput {
  id?: string;
  slug?: string;
  status?: PublishStatus;
  repoUrl?: string | null;
  liveUrl?: string | null;
  embedUrl?: string | null;
  embedHeight?: number | null;
  coverUrl?: string | null;
  techStack?: string[];
  sortOrder?: number;
  featured?: boolean;
  translations: Array<{
    locale: Locale;
    name: string;
    summary: string;
    bodyMarkdown?: string | null;
  }>;
}

/**
 * Creates or updates a project entry.
 *
 * @param input The project and its translations.
 * @returns The project id.
 */
export async function saveProject(input: ProjectInput): Promise<string> {
  if (input.translations.length === 0) {
    throw new Error('A project needs at least one translation.');
  }

  const primary = input.translations[0];
  const desiredSlug = slugify(input.slug?.trim() || primary?.name || '');
  const slug = await uniqueSlug(desiredSlug, async (candidate) => {
    const clash = await db.project.findUnique({
      where: {slug: candidate},
      select: {id: true},
    });
    return clash !== null && clash.id !== input.id;
  });

  const rendered = await Promise.all(
    input.translations.map(async (translation) => ({
      input: translation,
      html: translation.bodyMarkdown
        ? (await renderMarkdown(translation.bodyMarkdown)).html
        : null,
    })),
  );

  const data = {
    slug,
    status: input.status ?? 'PUBLISHED',
    repoUrl: input.repoUrl ?? null,
    liveUrl: input.liveUrl ?? null,
    embedUrl: input.embedUrl ?? null,
    embedHeight: input.embedHeight ?? null,
    coverUrl: input.coverUrl ?? null,
    techStack: input.techStack ?? [],
    sortOrder: input.sortOrder ?? 0,
    featured: input.featured ?? false,
  };

  return db.$transaction(async (tx) => {
    const project = input.id
      ? await tx.project.update({where: {id: input.id}, data})
      : await tx.project.create({data});

    for (const item of rendered) {
      const translationData = {
        name: item.input.name,
        summary: item.input.summary,
        bodyMarkdown: item.input.bodyMarkdown ?? null,
        bodyHtml: item.html,
      };

      await tx.projectTranslation.upsert({
        where: {
          projectId_locale: {
            projectId: project.id,
            locale: item.input.locale,
          },
        },
        create: {
          projectId: project.id,
          locale: item.input.locale,
          ...translationData,
        },
        update: translationData,
      });
    }

    return project.id;
  });
}

/** Everything needed to create or update a standalone page. */
export interface PageInput {
  slug: string;
  status?: PublishStatus;
  navOrder?: number | null;
  icon?: string | null;
  translations: Array<{locale: Locale; title: string; bodyMarkdown: string}>;
}

/**
 * Creates or updates a standalone page, keyed by slug.
 *
 * @param input The page and its translations.
 * @returns The page id.
 */
export async function savePage(input: PageInput): Promise<string> {
  const rendered = await Promise.all(
    input.translations.map(async (translation) => ({
      input: translation,
      html: (await renderMarkdown(translation.bodyMarkdown)).html,
    })),
  );

  const data = {
    status: input.status ?? 'PUBLISHED',
    navOrder: input.navOrder ?? null,
    icon: input.icon ?? null,
  };

  return db.$transaction(async (tx) => {
    const page = await tx.page.upsert({
      where: {slug: input.slug},
      create: {slug: input.slug, ...data},
      update: data,
    });

    for (const item of rendered) {
      const translationData = {
        title: item.input.title,
        bodyMarkdown: item.input.bodyMarkdown,
        bodyHtml: item.html,
      };

      await tx.pageTranslation.upsert({
        where: {pageId_locale: {pageId: page.id, locale: item.input.locale}},
        create: {
          pageId: page.id,
          locale: item.input.locale,
          ...translationData,
        },
        update: translationData,
      });
    }

    return page.id;
  });
}
