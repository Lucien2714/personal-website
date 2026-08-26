'use server';

import {revalidatePath} from 'next/cache';
import {z} from 'zod';

import {requireUserForAction} from '@/lib/auth/guard';
import {saveProject} from '@/lib/content/authoring';
import {db} from '@/lib/db';

/** Server actions behind the projects screen. */

/** Payload accepted by the project editor. */
const projectSchema = z.object({
  id: z.string().optional(),
  slug: z.string().trim().max(120).optional(),
  status: z.enum(['DRAFT', 'PUBLISHED', 'ARCHIVED']),
  repoUrl: z.string().trim().optional(),
  liveUrl: z.string().trim().optional(),
  embedUrl: z.string().trim().optional(),
  embedHeight: z.number().int().min(120).max(2000).optional(),
  coverUrl: z.string().trim().optional(),
  techStack: z.array(z.string().trim().min(1)).max(20),
  sortOrder: z.number().int().min(-999).max(999),
  featured: z.boolean(),
  translations: z
    .array(
      z.object({
        locale: z.enum(['EN', 'ZH']),
        name: z.string().trim().max(120),
        summary: z.string().trim().max(500),
        bodyMarkdown: z.string().optional(),
      }),
    )
    .min(1),
});

/** What the editor receives back. */
export interface SaveProjectResult {
  ok: boolean;
  projectId?: string;
  message?: string;
}

/**
 * Creates or updates a project.
 *
 * @param input The editor payload.
 */
export async function saveProjectAction(
  input: unknown,
): Promise<SaveProjectResult> {
  await requireUserForAction();

  const parsed = projectSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      message:
        parsed.error.issues[0] &&
        `${parsed.error.issues[0].path.join('.')}: ${parsed.error.issues[0].message}`,
    };
  }

  const form = parsed.data;

  // A translation with no name is a language the author has not filled in.
  const translations = form.translations.filter(
    (translation) => translation.name.length > 0,
  );

  if (translations.length === 0) {
    return {ok: false, message: 'Give the project a name in one language.'};
  }

  try {
    const projectId = await saveProject({
      id: form.id,
      slug: form.slug,
      status: form.status,
      repoUrl: form.repoUrl || null,
      liveUrl: form.liveUrl || null,
      embedUrl: form.embedUrl || null,
      embedHeight: form.embedHeight ?? null,
      coverUrl: form.coverUrl || null,
      techStack: form.techStack,
      sortOrder: form.sortOrder,
      featured: form.featured,
      translations: translations.map((translation) => ({
        ...translation,
        bodyMarkdown: translation.bodyMarkdown || null,
      })),
    });

    revalidatePath('/', 'layout');
    return {ok: true, projectId};
  } catch (error) {
    console.error('[admin] saveProjectAction failed', error);
    return {ok: false, message: 'The project could not be saved.'};
  }
}

/**
 * Deletes a project and its translations.
 *
 * Projects are hard-deleted: unlike a post, a project entry carries no
 * readership or inbound links worth preserving after its removal.
 *
 * @param id Identifier of the project.
 */
export async function deleteProjectAction(id: string): Promise<{ok: boolean}> {
  await requireUserForAction();

  try {
    await db.project.delete({where: {id}});
    revalidatePath('/', 'layout');
    return {ok: true};
  } catch (error) {
    console.error('[admin] deleteProjectAction failed', error);
    return {ok: false};
  }
}
