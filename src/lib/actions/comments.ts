'use server';

import {revalidatePath} from 'next/cache';
import {headers} from 'next/headers';
import {z} from 'zod';

import type {CommentStatus} from '@/generated/prisma/enums';
import {checkRateLimit, clientIdentifier} from '@/lib/api/rate-limit';
import {requireReaderForAction} from '@/lib/auth/guard';
import {
  COMMENT_MAX_LENGTH,
  renderComment,
} from '@/lib/content/comment-markdown';
import {
  type CommentTarget,
  targetColumns,
  targetFilter,
} from '@/lib/content/comments';
import {getSiteSettings} from '@/lib/content/settings';
import {db} from '@/lib/db';

/**
 * Server actions behind the comment form.
 *
 * Each one re-checks the session itself. A server action is a public HTTP
 * endpoint, so the fact that the page only shows the form to signed-in readers
 * protects the page, not the action.
 */

/** How many comments one account may post per minute. */
const COMMENTS_PER_MINUTE = 5;

/** Payload accepted when posting. */
const createSchema = z.object({
  target: z.object({
    type: z.enum(['post', 'moment', 'project']),
    id: z.string().min(1),
  }),
  parentId: z.string().min(1).nullish(),
  body: z
    .string()
    .trim()
    .min(1, 'Write something first.')
    .max(COMMENT_MAX_LENGTH),
});

/**
 * Why a comment action failed.
 *
 * A key rather than a sentence: the site is bilingual, and an action that
 * returned English prose would either leak it into a Chinese page or force
 * the action to know the reader's locale, which it has no other reason to.
 */
export type CommentErrorKey =
  | 'signInRequired'
  | 'empty'
  | 'tooLong'
  | 'closed'
  | 'tooQuick'
  | 'parentMissing'
  | 'notEditable'
  | 'saveFailed';

/** What the form receives back. */
export type CommentActionResult =
  {ok: true; status: CommentStatus} | {ok: false; errorKey: CommentErrorKey};

/** Maps a schema failure onto the key the form should show. */
function validationErrorKey(error: z.ZodError): CommentErrorKey {
  return error.issues.some((issue) => issue.code === 'too_big')
    ? 'tooLong'
    : 'empty';
}

/** Reads the caller's address for the moderation record and rate limiting. */
async function requestContext(): Promise<{ip: string; userAgent: string}> {
  const headerList = await headers();
  return {
    ip: clientIdentifier(
      new Request('http://localhost', {headers: headerList}),
    ),
    userAgent: headerList.get('user-agent')?.slice(0, 512) ?? '',
  };
}

/**
 * Decides whether a new comment is visible immediately.
 *
 * Under the `first-post` policy the check is "has this person had a comment
 * published before?" rather than "how many have they written?", so someone
 * whose first attempt was marked spam does not quietly earn approval by
 * trying again.
 */
async function resolveStatus(authorId: string): Promise<CommentStatus> {
  const settings = await getSiteSettings();

  switch (settings.commentModeration) {
    case 'all':
      return 'PENDING';
    case 'none':
      return 'PUBLISHED';
    case 'first-post': {
      const approved = await db.comment.count({
        where: {authorId, status: 'PUBLISHED', deletedAt: null},
      });
      return approved > 0 ? 'PUBLISHED' : 'PENDING';
    }
  }
}

/** True when the site accepts comments on this kind of target at all. */
async function commentsOpenFor(target: CommentTarget): Promise<boolean> {
  const settings = await getSiteSettings();

  if (!settings.commentsEnabled) {
    return false;
  }

  switch (target.type) {
    case 'post':
      return settings.commentsOnPosts;
    case 'moment':
      return settings.commentsOnMoments;
    case 'project':
      return settings.commentsOnProjects;
  }
}

/**
 * Posts a comment.
 *
 * @param input The form payload.
 */
export async function createCommentAction(
  input: unknown,
): Promise<CommentActionResult> {
  let user;
  try {
    user = await requireReaderForAction();
  } catch {
    return {ok: false, errorKey: 'signInRequired'};
  }

  const parsed = createSchema.safeParse(input);
  if (!parsed.success) {
    return {ok: false, errorKey: validationErrorKey(parsed.error)};
  }

  const {target, body, parentId} = parsed.data;

  if (!(await commentsOpenFor(target))) {
    return {ok: false, errorKey: 'closed'};
  }

  // Budgeted per account rather than per address: readers behind one office
  // or campus NAT share an address and should not share a limit.
  const limit = checkRateLimit(`comment:${user.id}`, COMMENTS_PER_MINUTE);
  if (!limit.allowed) {
    return {ok: false, errorKey: 'tooQuick'};
  }

  // A reply must belong to the same target, or a crafted parentId could graft
  // a thread from one post onto another.
  if (parentId) {
    const parent = await db.comment.findFirst({
      where: {id: parentId, ...targetFilter(target), deletedAt: null},
      select: {id: true, parentId: true},
    });

    if (!parent) {
      return {ok: false, errorKey: 'parentMissing'};
    }
  }

  const rendered = await renderComment(body);
  if (rendered.text.length === 0) {
    // Markdown that survives sanitising as nothing at all - a lone image, say.
    return {ok: false, errorKey: 'empty'};
  }

  const context = await requestContext();
  const status = await resolveStatus(user.id);

  try {
    await db.comment.create({
      data: {
        ...targetColumns(target),
        authorId: user.id,
        // Replies are one level deep: replying to a reply attaches to that
        // reply's parent, keeping the thread two levels tall at most.
        parentId: parentId ?? null,
        bodyMarkdown: body,
        bodyHtml: rendered.html,
        status,
        ipAddress: context.ip === 'unknown' ? null : context.ip,
        userAgent: context.userAgent || null,
      },
    });
  } catch (error) {
    console.error('[comments] create failed', error);
    return {ok: false, errorKey: 'saveFailed'};
  }

  revalidatePath('/', 'layout');
  return {ok: true, status};
}

/** Payload accepted when editing. */
const editSchema = z.object({
  id: z.string().min(1),
  body: z.string().trim().min(1).max(COMMENT_MAX_LENGTH),
});

/**
 * Edits one's own comment.
 *
 * There is no time limit. A comment with a visible "edited" marker is honest
 * enough, and a window that expires mid-typo is a worse experience than the
 * problem it solves.
 *
 * @param input The edit payload.
 */
export async function editCommentAction(
  input: unknown,
): Promise<CommentActionResult> {
  let user;
  try {
    user = await requireReaderForAction();
  } catch {
    return {ok: false, errorKey: 'signInRequired'};
  }

  const parsed = editSchema.safeParse(input);
  if (!parsed.success) {
    return {ok: false, errorKey: validationErrorKey(parsed.error)};
  }

  const existing = await db.comment.findFirst({
    where: {id: parsed.data.id, authorId: user.id, deletedAt: null},
    select: {id: true, status: true},
  });

  if (!existing) {
    // Covers both "no such comment" and "not yours" on purpose: the two are
    // indistinguishable to the caller, so neither confirms the other's id.
    return {ok: false, errorKey: 'notEditable'};
  }

  const rendered = await renderComment(parsed.data.body);
  if (rendered.text.length === 0) {
    return {ok: false, errorKey: 'empty'};
  }

  await db.comment.update({
    where: {id: existing.id},
    data: {
      bodyMarkdown: parsed.data.body,
      bodyHtml: rendered.html,
      editedAt: new Date(),
    },
  });

  revalidatePath('/', 'layout');
  return {ok: true, status: existing.status};
}

/**
 * Deletes one's own comment.
 *
 * Soft-deleted, so that replies to it survive; `listComments` promotes an
 * orphaned reply to the top level rather than hiding it.
 *
 * @param id Identifier of the comment.
 */
export async function deleteOwnCommentAction(
  id: string,
): Promise<{ok: boolean}> {
  let user;
  try {
    user = await requireReaderForAction();
  } catch {
    return {ok: false};
  }

  const {count} = await db.comment.updateMany({
    where: {id, authorId: user.id, deletedAt: null},
    data: {deletedAt: new Date()},
  });

  if (count > 0) {
    revalidatePath('/', 'layout');
  }

  return {ok: count > 0};
}
