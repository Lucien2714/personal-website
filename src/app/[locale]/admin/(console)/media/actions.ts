'use server';

import {revalidatePath} from 'next/cache';

import {requireUserForAction} from '@/lib/auth/guard';
import {deleteMedia} from '@/lib/media/storage';

/** Server actions behind the media library. */

/**
 * Deletes an uploaded file and its index row.
 *
 * Nothing checks whether the file is still referenced by a post: doing so
 * reliably would mean scanning every stored Markdown body on every delete. The
 * console asks for confirmation instead, and a broken image is a visible,
 * recoverable mistake rather than a silent one.
 *
 * @param id Identifier of the media row.
 */
export async function deleteMediaAction(id: string): Promise<{ok: boolean}> {
  await requireUserForAction();

  try {
    await deleteMedia(id);
    revalidatePath('/', 'layout');
    return {ok: true};
  } catch (error) {
    console.error('[admin] deleteMediaAction failed', error);
    return {ok: false};
  }
}
