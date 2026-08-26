import type {Prisma} from '@/generated/prisma/client';
import type {CommentStatus} from '@/generated/prisma/enums';
import {db} from '@/lib/db';

/**
 * Read-side queries for comments.
 *
 * The one rule that lives here, so no page has to remember it: a comment is
 * visible when it is published and not deleted. Pending and spam rows stay in
 * the table - so a moderation decision is reversible, and so an author is not
 * told which of their comments disappeared - but never reach a reader.
 */

/** What a comment can be attached to. */
export type CommentTargetType = 'post' | 'moment' | 'project';

/** Identifies the thing being commented on. */
export interface CommentTarget {
  type: CommentTargetType;
  id: string;
}

/** A comment as rendered on the page. */
export interface CommentView {
  id: string;
  bodyHtml: string;
  createdAt: Date;
  editedAt: Date | null;
  author: {
    id: string;
    displayName: string;
    avatarUrl: string | null;
    websiteUrl: string | null;
    /** True when the comment is by the site owner or an editor. */
    isStaff: boolean;
  };
  /** Replies to this comment, oldest first. Always empty on a reply itself. */
  replies: CommentView[];
}

/**
 * Turns a target into the `where` fragment that selects it.
 *
 * The three nullable foreign keys are an implementation detail of the schema;
 * this is the only place that knows which column belongs to which type.
 */
export function targetFilter(target: CommentTarget): Prisma.CommentWhereInput {
  switch (target.type) {
    case 'post':
      return {postId: target.id};
    case 'moment':
      return {momentId: target.id};
    case 'project':
      return {projectId: target.id};
  }
}

/** Turns a target into the fields written when creating a comment. */
export function targetColumns(
  target: CommentTarget,
): Pick<
  Prisma.CommentUncheckedCreateInput,
  'postId' | 'momentId' | 'projectId'
> {
  return {
    postId: target.type === 'post' ? target.id : null,
    momentId: target.type === 'moment' ? target.id : null,
    projectId: target.type === 'project' ? target.id : null,
  };
}

/** The filter that defines a publicly visible comment. */
export function publicCommentFilter(): Prisma.CommentWhereInput {
  return {
    deletedAt: null,
    status: 'PUBLISHED' satisfies CommentStatus,
  };
}

/** Shape selected for every comment the site renders. */
const commentSelect = {
  id: true,
  bodyHtml: true,
  createdAt: true,
  editedAt: true,
  parentId: true,
  author: {
    select: {
      id: true,
      displayName: true,
      avatarUrl: true,
      websiteUrl: true,
      role: true,
    },
  },
} as const;

/** Row shape produced by `commentSelect`. */
type CommentRow = Prisma.CommentGetPayload<{select: typeof commentSelect}>;

/** Converts a row into the view model, without its replies. */
function toView(row: CommentRow): CommentView {
  return {
    id: row.id,
    bodyHtml: row.bodyHtml,
    createdAt: row.createdAt,
    editedAt: row.editedAt,
    author: {
      id: row.author.id,
      displayName: row.author.displayName,
      avatarUrl: row.author.avatarUrl,
      websiteUrl: row.author.websiteUrl,
      isStaff: row.author.role === 'ADMIN' || row.author.role === 'EDITOR',
    },
    replies: [],
  };
}

/**
 * Loads the visible comments for one target, threaded one level deep.
 *
 * Fetched in a single query and assembled in memory rather than as a
 * per-parent query each: a busy post has tens of comments, not thousands, and
 * one round trip beats N.
 *
 * @param target What the comments are attached to.
 */
export async function listComments(
  target: CommentTarget,
): Promise<CommentView[]> {
  const rows = await db.comment.findMany({
    where: {...publicCommentFilter(), ...targetFilter(target)},
    orderBy: {createdAt: 'asc'},
    select: commentSelect,
  });

  const views = new Map<string, CommentView>();
  for (const row of rows) {
    views.set(row.id, toView(row));
  }

  const roots: CommentView[] = [];
  for (const row of rows) {
    const view = views.get(row.id);
    if (!view) {
      continue;
    }

    // A reply whose parent is hidden is promoted to the top level rather than
    // dropped: removing one comment should not silently remove the answers to
    // it, which may stand on their own.
    const parent = row.parentId ? views.get(row.parentId) : undefined;
    if (parent) {
      parent.replies.push(view);
    } else {
      roots.push(view);
    }
  }

  // Newest conversations last, matching the reading order of a thread.
  return roots;
}

/**
 * Counts the visible comments on one target.
 *
 * @param target What the comments are attached to.
 */
export async function countComments(target: CommentTarget): Promise<number> {
  return db.comment.count({
    where: {...publicCommentFilter(), ...targetFilter(target)},
  });
}

/**
 * Counts visible comments for several targets at once.
 *
 * Used by index pages, which would otherwise issue one count per card.
 *
 * @param type Which kind of target the ids refer to.
 * @param ids The targets to count for.
 * @returns A map from target id to count; absent ids have no comments.
 */
export async function countCommentsByTarget(
  type: CommentTargetType,
  ids: string[],
): Promise<Map<string, number>> {
  if (ids.length === 0) {
    return new Map();
  }

  const column =
    type === 'post' ? 'postId' : type === 'moment' ? 'momentId' : 'projectId';

  const grouped = await db.comment.groupBy({
    by: [column],
    where: {...publicCommentFilter(), [column]: {in: ids}},
    _count: {_all: true},
  });

  const counts = new Map<string, number>();
  for (const row of grouped) {
    const key = (row as Record<string, unknown>)[column];
    if (typeof key === 'string') {
      counts.set(key, row._count._all);
    }
  }

  return counts;
}
