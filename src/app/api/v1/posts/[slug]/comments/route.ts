import {apiError, defineApiRoute} from '@/lib/api/handler';
import {apiPreflight, apiSuccess} from '@/lib/api/response';
import {readLocale} from '@/lib/api/serializers';
import {listComments} from '@/lib/content/comments';
import {getPostBySlug} from '@/lib/content/posts';

/**
 * `/api/v1/posts/{slug}/comments` - the published thread on one post.
 *
 * Read-only. Posting a comment needs a reader session rather than an API key,
 * because a comment is attributed to a person and an API key belongs to a
 * program; letting a key write comments would mean either inventing an author
 * or attributing every one of them to the site owner.
 *
 * Email addresses are never included. The author fields here are exactly what
 * the site itself renders.
 */

export const GET = defineApiRoute<undefined, {slug: string}>({
  handler: async ({request, params, query}) => {
    const post = await getPostBySlug(
      decodeURIComponent(params.slug),
      readLocale(query),
    );

    if (!post) {
      return apiError(request, 'not_found', 'No published post has that slug.');
    }

    const comments = await listComments({type: 'post', id: post.id});

    /** Serialises one comment and its replies. */
    const serialize = (comment: (typeof comments)[number]): unknown => ({
      id: comment.id,
      html: comment.bodyHtml,
      createdAt: comment.createdAt.toISOString(),
      editedAt: comment.editedAt?.toISOString() ?? null,
      author: {
        name: comment.author.displayName,
        avatarUrl: comment.author.avatarUrl,
        websiteUrl: comment.author.websiteUrl,
        isStaff: comment.author.isStaff,
      },
      replies: comment.replies.map(serialize),
    });

    return apiSuccess(request, comments.map(serialize));
  },
});

/** Answers CORS preflight requests. */
export function OPTIONS(request: Request) {
  return apiPreflight(request);
}
