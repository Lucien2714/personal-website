'use server';

import {revalidatePath} from 'next/cache';
import {z} from 'zod';

import {requireStaffForAction} from '@/lib/auth/guard';
import {saveMoment} from '@/lib/content/authoring';
import {db} from '@/lib/db';
import {storeUpload} from '@/lib/media/storage';

/** Server actions behind the moments composer. */

/** Payload accepted by the composer. */
const momentSchema = z.object({
  id: z.string().optional(),
  body: z.string().trim().min(1, 'Write something first.').max(2000),
  mood: z.string().trim().max(16).optional(),
  location: z.string().trim().max(120).optional(),
  images: z.array(z.string()).max(9),
});

/** What the composer receives back. */
export interface SaveMomentResult {
  ok: boolean;
  message?: string;
}

/**
 * Publishes or updates a moment.
 *
 * @param input The composer payload.
 */
export async function saveMomentAction(
  input: unknown,
): Promise<SaveMomentResult> {
  const user = await requireStaffForAction();

  const parsed = momentSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      message: parsed.error.issues[0]?.message ?? 'Invalid input.',
    };
  }

  try {
    await saveMoment({
      id: parsed.data.id,
      authorId: user.id,
      body: parsed.data.body,
      images: parsed.data.images,
      mood: parsed.data.mood || null,
      location: parsed.data.location || null,
      status: 'PUBLISHED',
    });

    revalidatePath('/', 'layout');
    return {ok: true};
  } catch (error) {
    console.error('[admin] saveMomentAction failed', error);
    return {ok: false, message: 'The moment could not be saved.'};
  }
}

/**
 * Soft-deletes a moment.
 *
 * @param id Identifier of the moment.
 */
export async function deleteMomentAction(id: string): Promise<{ok: boolean}> {
  await requireStaffForAction();

  try {
    await db.moment.update({
      where: {id},
      data: {deletedAt: new Date(), status: 'ARCHIVED'},
    });
    revalidatePath('/', 'layout');
    return {ok: true};
  } catch (error) {
    console.error('[admin] deleteMomentAction failed', error);
    return {ok: false};
  }
}

/**
 * Uploads an image from the composer or the media library.
 *
 * Returns the public URL rather than the media id, because every caller wants
 * to paste a URL into Markdown or into a moment's image list.
 *
 * @param formData A form carrying a single `file` field.
 */
export async function uploadImageAction(
  formData: FormData,
): Promise<{ok: true; url: string} | {ok: false; message: string}> {
  const user = await requireStaffForAction();

  const file = formData.get('file');
  if (!(file instanceof File)) {
    return {ok: false, message: 'No file was supplied.'};
  }

  const result = await storeUpload(file, user.id);
  if (!result.ok) {
    return {ok: false, message: result.message};
  }

  return {ok: true, url: result.url};
}
