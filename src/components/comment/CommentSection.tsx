import {getTranslations} from 'next-intl/server';

import {CommentForm} from '@/components/comment/CommentForm';
import {CommentItem} from '@/components/comment/CommentItem';
import {Link} from '@/i18n/navigation';
import {getSessionUser} from '@/lib/auth/session';
import {type CommentTarget, listComments} from '@/lib/content/comments';
import {getSiteSettings} from '@/lib/content/settings';

/**
 * The comment section under a post, moment or project.
 *
 * A server component: it loads the thread, the settings and the session in one
 * render, and hands the interactive parts down as small client components.
 * Nothing about who is signed in reaches the client except the viewer's own
 * id, which is what the edit and delete buttons need.
 */

/** Props accepted by {@link CommentSection}. */
export interface CommentSectionProps {
  target: CommentTarget;
  /**
   * Publication date of the thing being commented on, used by the
   * "close comments after N days" setting. Omit to keep them open.
   */
  publishedAt?: Date | null;
  /** Path to return to after signing in. */
  returnTo: string;
}

/**
 * True when a thread has aged past the configured cut-off.
 *
 * A plain function rather than an expression in the component body: reading
 * the clock is impure, and the React Compiler is right to refuse it there
 * even though this particular component only ever runs on the server.
 */
function isThreadClosed(
  publishedAt: Date | null | undefined,
  closeAfterDays: number,
): boolean {
  if (closeAfterDays <= 0 || !publishedAt) {
    return false;
  }

  const ageMs = Date.now() - publishedAt.getTime();
  return ageMs > closeAfterDays * 24 * 60 * 60 * 1000;
}

/** True when the setting for this kind of target allows comments. */
function enabledForTarget(
  target: CommentTarget,
  settings: Awaited<ReturnType<typeof getSiteSettings>>,
): boolean {
  switch (target.type) {
    case 'post':
      return settings.commentsOnPosts;
    case 'moment':
      return settings.commentsOnMoments;
    case 'project':
      return settings.commentsOnProjects;
  }
}

/** Renders the thread and the composer. */
export async function CommentSection({
  target,
  publishedAt,
  returnTo,
}: CommentSectionProps) {
  const [t, tSignIn, settings, viewer] = await Promise.all([
    getTranslations('comments'),
    getTranslations('signin'),
    getSiteSettings(),
    getSessionUser(),
  ]);

  if (!settings.commentsEnabled || !enabledForTarget(target, settings)) {
    return null;
  }

  const comments = await listComments(target);

  // Threads on old posts can be closed without hiding what was already said.
  const closedByAge = isThreadClosed(
    publishedAt,
    settings.commentsCloseAfterDays,
  );

  const canComment = viewer !== null && !viewer.blockedAt && !closedByAge;

  const total =
    comments.length +
    comments.reduce((sum, comment) => sum + comment.replies.length, 0);

  return (
    <section
      id="comments"
      aria-labelledby="comments-heading"
      className="mt-14 border-t border-[var(--color-border)] pt-8"
    >
      <h2
        id="comments-heading"
        className="mb-6 flex items-center gap-2.5 font-display text-xl font-bold"
      >
        <span
          aria-hidden="true"
          className="h-4 w-0.5 rounded-full bg-[var(--color-accent)]"
        />
        {t('title')}
        <span className="text-sm font-normal text-[var(--color-ink-subtle)]">
          {t('count', {count: total})}
        </span>
      </h2>

      {closedByAge ? (
        <p className="card p-4 text-sm text-[var(--color-ink-muted)]">
          {t('closed')}
        </p>
      ) : canComment ? (
        <div className="card p-4">
          <CommentForm target={target} />
        </div>
      ) : (
        <div className="card flex flex-wrap items-center justify-between gap-3 p-4">
          <p className="text-sm text-[var(--color-ink-muted)]">
            {t('signInPrompt')}
          </p>
          <Link
            href={`/signin?next=${encodeURIComponent(returnTo)}`}
            className="rounded-lg bg-[var(--color-accent)] px-4 py-2 text-sm font-semibold text-[var(--color-on-accent)] transition hover:opacity-90"
          >
            {tSignIn('title')}
          </Link>
        </div>
      )}

      {comments.length > 0 && (
        <div className="mt-8 space-y-7">
          {comments.map((comment) => (
            <CommentItem
              key={comment.id}
              comment={comment}
              target={target}
              viewerId={viewer?.id ?? null}
              canReply={canComment}
            />
          ))}
        </div>
      )}
    </section>
  );
}
