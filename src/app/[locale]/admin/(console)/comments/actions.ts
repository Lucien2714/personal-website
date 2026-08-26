'use server';

import {revalidatePath} from 'next/cache';

import type {CommentStatus} from '@/generated/prisma/enums';
import {requireStaffForAction} from '@/lib/auth/guard';
import {db} from '@/lib/db';

/**
 * Moderation actions.
 *
 * Separate from the reader-facing actions in src/lib/actions/comments.ts, and
 * guarded differently: these require staff, those require only a session. Two
 * files rather than one branch, so the two guards can never be confused for
 * each other.
 */

/**
 * Moves a comment to a status.
 *
 * @param id Identifier of the comment.
 * @param status Where it should end up.
 */
export async function setCommentStatusAction(
  id: string,
  status: CommentStatus,
): Promise<{ok: boolean}> {
  await requireStaffForAction();

  try {
    await db.comment.update({
      where: {id},
      // Approving a previously deleted comment restores it, which is what the
      // moderator means by pressing "approve" on a deleted row.
      data: {status, deletedAt: null},
    });
    revalidatePath('/', 'layout');
    return {ok: true};
  } catch (error) {
    console.error('[admin] setCommentStatusAction failed', error);
    return {ok: false};
  }
}

/**
 * Removes a comment from the site.
 *
 * Soft-deleted, so the thread's shape and the moderator's decision both stay
 * recoverable.
 *
 * @param id Identifier of the comment.
 */
export async function deleteCommentAction(id: string): Promise<{ok: boolean}> {
  await requireStaffForAction();

  try {
    await db.comment.update({
      where: {id},
      data: {deletedAt: new Date()},
    });
    revalidatePath('/', 'layout');
    return {ok: true};
  } catch (error) {
    console.error('[admin] deleteCommentAction failed', error);
    return {ok: false};
  }
}

/**
 * Blocks or unblocks a commenter.
 *
 * A blocked account can still sign in; only its ability to post is withdrawn.
 * Refusing the sign-in outright would make the block obvious and invite a
 * second account, which is a worse outcome than a quiet one.
 *
 * @param userId The account to act on.
 * @param blocked Whether it should be blocked.
 */
export async function setUserBlockedAction(
  userId: string,
  blocked: boolean,
): Promise<{ok: boolean}> {
  const staff = await requireStaffForAction();

  // Blocking oneself would lock the owner out of their own comment section
  // with no obvious way back.
  if (staff.id === userId) {
    return {ok: false};
  }

  try {
    await db.user.update({
      where: {id: userId},
      data: {blockedAt: blocked ? new Date() : null},
    });

    if (blocked) {
      // Hide what they have already posted, in one step rather than row by row.
      await db.comment.updateMany({
        where: {authorId: userId, status: 'PUBLISHED'},
        data: {status: 'SPAM'},
      });
    }

    revalidatePath('/', 'layout');
    return {ok: true};
  } catch (error) {
    console.error('[admin] setUserBlockedAction failed', error);
    return {ok: false};
  }
}
