'use server';

import {revalidatePath} from 'next/cache';
import {z} from 'zod';

import {requireUserForAction} from '@/lib/auth/guard';
import {savePost, softDeletePost} from '@/lib/content/authoring';
import {renderMarkdown} from '@/lib/content/markdown';
import {db} from '@/lib/db';

/**
 * Server actions behind the post editor.
 *
 * Every action re-checks the session. The console layout already refuses
 * anonymous visitors, but a server action is a public HTTP endpoint in its own
 * right - anyone who learns its identifier can invoke it directly - so the
 * layout's check protects the page, not the action.
 */

/** One language rendition submitted by the editor. */
const translationSchema = z.object({
  locale: z.enum(['EN', 'ZH']),
  title: z.string().trim().min(1, 'A title is required.').max(300),
  slug: z.string().trim().max(120).optional(),
  description: z.string().trim().max(500).optional(),
  bodyMarkdown: z.string(),
});

/** The editor's full payload. */
const postFormSchema = z.object({
  id: z.string().optional(),
  status: z.enum(['DRAFT', 'SCHEDULED', 'PUBLISHED', 'ARCHIVED']),
  publishedAt: z.string().optional(),
  pinned: z.boolean(),
  coverUrl: z.string().trim().optional(),
  categories: z.array(z.string().trim().min(1)),
  tags: z.array(z.string().trim().min(1)),
  translations: z.array(translationSchema).min(1),
});

/** What the editor receives back from a save. */
export interface SavePostResult {
  ok: boolean;
  postId?: string;
  /** Field-level problems, keyed by a dotted path. */
  errors?: Array<{path: string; message: string}>;
  message?: string;
}

/**
 * Creates or updates a post.
 *
 * @param input The editor payload, already JSON-serialisable.
 */
export async function savePostAction(input: unknown): Promise<SavePostResult> {
  const user = await requireUserForAction();

  const parsed = postFormSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      errors: parsed.error.issues.map((issue) => ({
        path: issue.path.join('.'),
        message: issue.message,
      })),
    };
  }

  const form = parsed.data;

  // Translations whose title and body are both empty represent a language the
  // author has not written yet. Dropping them here is what lets the editor
  // show both tabs unconditionally.
  const translations = form.translations.filter(
    (translation) =>
      translation.title.length > 0 ||
      translation.bodyMarkdown.trim().length > 0,
  );

  if (translations.length === 0) {
    return {
      ok: false,
      errors: [{path: 'translations', message: 'Write at least one version.'}],
    };
  }

  try {
    const postId = await savePost({
      id: form.id,
      authorId: user.id,
      status: form.status,
      publishedAt: form.publishedAt ? new Date(form.publishedAt) : null,
      pinned: form.pinned,
      coverUrl: form.coverUrl || null,
      categories: form.categories,
      tags: form.tags,
      translations,
    });

    // The public pages are rendered per request, but Next.js still caches the
    // router payload on the client; invalidating the paths keeps a freshly
    // published post from being invisible until a hard reload.
    revalidatePath('/', 'layout');

    return {ok: true, postId};
  } catch (error) {
    console.error('[admin] savePostAction failed', error);
    return {
      ok: false,
      message: 'The post could not be saved. Check the server logs.',
    };
  }
}

/**
 * Soft-deletes a post.
 *
 * @param postId Identifier of the post to remove.
 */
export async function deletePostAction(postId: string): Promise<{ok: boolean}> {
  await requireUserForAction();

  try {
    await softDeletePost(postId);
    revalidatePath('/', 'layout');
    return {ok: true};
  } catch (error) {
    console.error('[admin] deletePostAction failed', error);
    return {ok: false};
  }
}

/**
 * Renders Markdown for the editor's preview pane.
 *
 * Preview runs through the same pipeline as a save, so what the author sees is
 * exactly what will be stored - including the sanitiser's effects.
 *
 * @param markdown The current editor contents.
 * @returns Sanitised HTML.
 */
export async function previewMarkdownAction(
  markdown: string,
): Promise<{html: string}> {
  await requireUserForAction();

  const rendered = await renderMarkdown(markdown);
  return {html: rendered.html};
}

/** A taxonomy option offered by the editor's autocomplete. */
export interface TaxonomySuggestion {
  slug: string;
  name: string;
}

/**
 * Lists existing categories and tags, so the editor can suggest them instead of
 * letting near-duplicates accumulate.
 *
 * @param locale Language used to resolve display names.
 */
export async function listTaxonomySuggestionsAction(
  locale: 'EN' | 'ZH',
): Promise<{categories: TaxonomySuggestion[]; tags: TaxonomySuggestion[]}> {
  await requireUserForAction();

  const [categories, tags] = await Promise.all([
    db.category.findMany({select: {slug: true, names: true}}),
    db.tag.findMany({select: {slug: true, names: true}}),
  ]);

  /** Reads a display name out of a `names` JSON column. */
  const nameOf = (names: unknown): string => {
    if (names && typeof names === 'object' && !Array.isArray(names)) {
      const record = names as Record<string, unknown>;
      const preferred = record[locale];
      if (typeof preferred === 'string') {
        return preferred;
      }
      const first = Object.values(record).find(
        (value): value is string => typeof value === 'string',
      );
      return first ?? '';
    }
    return '';
  };

  return {
    categories: categories.map((item) => ({
      slug: item.slug,
      name: nameOf(item.names),
    })),
    tags: tags.map((item) => ({slug: item.slug, name: nameOf(item.names)})),
  };
}
