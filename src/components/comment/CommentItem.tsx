'use client';

import {useRouter} from 'next/navigation';
import {useState, useTransition} from 'react';
import {useFormatter, useTranslations} from 'next-intl';

import {CommentForm} from '@/components/comment/CommentForm';
import {Chip} from '@/components/ui/primitives';
import {deleteOwnCommentAction} from '@/lib/actions/comments';
import type {CommentTarget, CommentView} from '@/lib/content/comments';
import {cn} from '@/lib/utils/cn';

/**
 * One comment, with its replies.
 *
 * A client component because reply, edit and delete are all local UI states;
 * the comment bodies themselves are rendered and sanitised on the server and
 * arrive as HTML.
 */

/** Props accepted by {@link CommentItem}. */
export interface CommentItemProps {
  comment: CommentView;
  target: CommentTarget;
  /** Id of the signed-in reader, or null. Controls edit and delete. */
  viewerId: string | null;
  /** True when the viewer may reply, i.e. is signed in and comments are open. */
  canReply: boolean;
  /** Replies render without their own reply button; threads are two deep. */
  isReply?: boolean;
}

/** Renders a comment. */
export function CommentItem({
  comment,
  target,
  viewerId,
  canReply,
  isReply = false,
}: CommentItemProps) {
  const t = useTranslations('comments');
  const format = useFormatter();
  const router = useRouter();

  const [isReplying, setReplying] = useState(false);
  const [isEditing, setEditing] = useState(false);
  const [isDeleting, startDeleting] = useTransition();

  const isOwn = viewerId !== null && viewerId === comment.author.id;

  const handleDelete = () => {
    if (!window.confirm(t('confirmDelete'))) {
      return;
    }

    startDeleting(async () => {
      const result = await deleteOwnCommentAction(comment.id);
      if (result.ok) {
        router.refresh();
      }
    });
  };

  return (
    <article
      id={`comment-${comment.id}`}
      className={cn('flex gap-3', isDeleting && 'opacity-50')}
    >
      <span className="mt-0.5 h-8 w-8 shrink-0 overflow-hidden rounded-lg bg-[var(--color-surface-sunken)]">
        {comment.author.avatarUrl && (
          // Deliberately a plain <img> rather than next/image. The URL comes
          // from a third-party profile, so routing it through the image
          // optimiser would make this server fetch an address a commenter
          // influences. `no-referrer` also keeps the page being read out of
          // the avatar host's logs.
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={comment.author.avatarUrl}
            alt=""
            width={32}
            height={32}
            loading="lazy"
            decoding="async"
            referrerPolicy="no-referrer"
            className="h-full w-full object-cover"
          />
        )}
      </span>

      <div className="min-w-0 flex-1">
        <header className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm">
          {comment.author.websiteUrl ? (
            <a
              href={comment.author.websiteUrl}
              target="_blank"
              rel="nofollow ugc noopener noreferrer"
              className="font-medium transition hover:text-[var(--color-accent)]"
            >
              {comment.author.displayName}
            </a>
          ) : (
            <span className="font-medium">{comment.author.displayName}</span>
          )}

          {comment.author.isStaff && <Chip tone="accent">{t('author')}</Chip>}

          <time
            dateTime={comment.createdAt.toISOString()}
            className="text-xs text-[var(--color-ink-subtle)]"
          >
            {format.relativeTime(comment.createdAt)}
          </time>

          {comment.editedAt && (
            <span className="text-xs text-[var(--color-ink-subtle)]">
              ({t('edited')})
            </span>
          )}
        </header>

        {isEditing ? (
          <div className="mt-2">
            <CommentForm
              editingId={comment.id}
              // The stored Markdown is not sent to the client, so editing
              // starts from the rendered text. Good enough for the light
              // markup a comment may contain, and it avoids shipping a second
              // copy of every comment body to every reader.
              initialBody={htmlToPlainText(comment.bodyHtml)}
              autoFocus
              onCancel={() => setEditing(false)}
              onDone={() => setEditing(false)}
            />
          </div>
        ) : (
          // Sanitised at save time by src/lib/content/comment-markdown.ts.
          <div
            className="prose-comment mt-1.5"
            dangerouslySetInnerHTML={{__html: comment.bodyHtml}}
          />
        )}

        {!isEditing && (
          <div className="mt-1.5 flex flex-wrap gap-3 text-xs">
            {canReply && !isReply && (
              <button
                type="button"
                onClick={() => setReplying((open) => !open)}
                className="font-medium text-[var(--color-ink-subtle)] transition hover:text-[var(--color-accent)]"
              >
                {t('reply')}
              </button>
            )}

            {isOwn && (
              <>
                <button
                  type="button"
                  onClick={() => setEditing(true)}
                  className="font-medium text-[var(--color-ink-subtle)] transition hover:text-[var(--color-accent)]"
                >
                  {t('edit')}
                </button>
                <button
                  type="button"
                  onClick={handleDelete}
                  disabled={isDeleting}
                  className="font-medium text-[var(--color-ink-subtle)] transition hover:text-[var(--color-danger)]"
                >
                  {t('delete')}
                </button>
              </>
            )}
          </div>
        )}

        {isReplying && (
          <div className="mt-3">
            <CommentForm
              target={target}
              parentId={comment.id}
              replyingToName={comment.author.displayName}
              autoFocus
              onCancel={() => setReplying(false)}
              onDone={() => setReplying(false)}
            />
          </div>
        )}

        {comment.replies.length > 0 && (
          <div className="mt-4 space-y-4 border-l border-[var(--color-border)] pl-4">
            {comment.replies.map((reply) => (
              <CommentItem
                key={reply.id}
                comment={reply}
                target={target}
                viewerId={viewerId}
                canReply={canReply}
                isReply
              />
            ))}
          </div>
        )}
      </div>
    </article>
  );
}

/**
 * Recovers editable text from rendered comment HTML.
 *
 * Lossy by design: block structure becomes newlines and inline markup is
 * dropped. Round-tripping exactly would mean sending every comment's Markdown
 * source to every reader, which is a lot of bytes for a button most of them
 * will never press.
 */
function htmlToPlainText(html: string): string {
  return html
    .replace(/<\/(p|li|blockquote|pre|h[1-6])>/gi, '\n\n')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<[^>]*>/g, '')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#x27;|&apos;/g, "'")
    .replace(/&amp;/g, '&')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}
