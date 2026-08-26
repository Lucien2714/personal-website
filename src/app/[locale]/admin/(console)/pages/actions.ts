'use server';

import {revalidatePath} from 'next/cache';
import {z} from 'zod';

import {requireStaffForAction} from '@/lib/auth/guard';
import {savePage} from '@/lib/content/authoring';
import {db} from '@/lib/db';

/** Server actions behind the standalone-page editor. */

/**
 * Slugs that would collide with a dedicated route.
 *
 * The first group are public sections; `new` is reserved because the console
 * itself routes `/admin/pages/new` to the creation screen.
 */
const RESERVED_SLUGS = new Set([
  'admin',
  'posts',
  'moments',
  'projects',
  'archives',
  'api',
  'signin',
  'new',
]);

/** Payload accepted by the page editor. */
const pageSchema = z.object({
  slug: z
    .string()
    .trim()
    .min(1, 'A slug is required.')
    .max(60)
    .regex(
      /^[a-z0-9]+(?:-[a-z0-9]+)*$/,
      'Use lower-case letters, digits and hyphens.',
    )
    .refine(
      (slug) => !RESERVED_SLUGS.has(slug),
      'That slug is used by a built-in section.',
    ),
  status: z.enum(['DRAFT', 'PUBLISHED', 'ARCHIVED']),
  navOrder: z.number().int().min(0).max(999).nullable(),
  icon: z.string().trim().max(40).optional(),
  translations: z
    .array(
      z.object({
        locale: z.enum(['EN', 'ZH']),
        title: z.string().trim().max(120),
        bodyMarkdown: z.string(),
      }),
    )
    .min(1),
});

/** What the editor receives back. */
export interface SavePageResult {
  ok: boolean;
  slug?: string;
  message?: string;
}

/**
 * Creates or updates a standalone page.
 *
 * @param input The editor payload.
 */
export async function savePageAction(input: unknown): Promise<SavePageResult> {
  await requireStaffForAction();

  const parsed = pageSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      message: parsed.error.issues[0]?.message ?? 'Invalid input.',
    };
  }

  const form = parsed.data;
  const translations = form.translations.filter(
    (translation) => translation.title.length > 0,
  );

  if (translations.length === 0) {
    return {ok: false, message: 'Give the page a title in one language.'};
  }

  try {
    await savePage({
      slug: form.slug,
      status: form.status,
      navOrder: form.navOrder,
      icon: form.icon || null,
      translations,
    });

    revalidatePath('/', 'layout');
    return {ok: true, slug: form.slug};
  } catch (error) {
    console.error('[admin] savePageAction failed', error);
    return {ok: false, message: 'The page could not be saved.'};
  }
}

/**
 * Deletes a standalone page.
 *
 * @param slug Slug of the page.
 */
export async function deletePageAction(slug: string): Promise<{ok: boolean}> {
  await requireStaffForAction();

  try {
    await db.page.delete({where: {slug}});
    revalidatePath('/', 'layout');
    return {ok: true};
  } catch (error) {
    console.error('[admin] deletePageAction failed', error);
    return {ok: false};
  }
}
