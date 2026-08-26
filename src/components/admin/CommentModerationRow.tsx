'use client';

import {useRouter} from 'next/navigation';
import {useTransition} from 'react';
import {useTranslations} from 'next-intl';

import {
  deleteCommentAction,
  setCommentStatusAction,
  setUserBlockedAction,
} from '@/app/[locale]/admin/(console)/comments/actions';
import type {CommentStatus} from '@/generated/prisma/enums';
import {cn} from '@/lib/utils/cn';

/**
 * The moderation controls on one comment row.
 *
 * A client component so the buttons can report progress; the row's content is
 * rendered by the server page around it.
 */

/** Props accepted by {@link CommentModerationRow}. */
export interface CommentModerationRowProps {
  commentId: string;
  authorId: string;
  authorBlocked: boolean;
  status: CommentStatus;
  /** True when the row belongs to the signed-in moderator. */
  isSelf: boolean;
}

/** Renders the approve / spam / delete / block controls. */
export function CommentModerationRow({
  commentId,
  authorId,
  authorBlocked,
  status,
  isSelf,
}: CommentModerationRowProps) {
  const t = useTranslations('admin');
  const router = useRouter();
  const [isBusy, startBusy] = useTransition();

  const run = (work: () => Promise<{ok: boolean}>) => {
    startBusy(async () => {
      const result = await work();
      if (result.ok) {
        router.refresh();
      }
    });
  };

  const buttonClass = cn(
    'rounded-lg border border-[var(--color-border)] px-2.5 py-1 text-xs font-medium transition disabled:opacity-50',
  );

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {status !== 'PUBLISHED' && (
        <button
          type="button"
          disabled={isBusy}
          onClick={() =>
            run(() => setCommentStatusAction(commentId, 'PUBLISHED'))
          }
          className={cn(
            buttonClass,
            'hover:border-[var(--color-success)] hover:text-[var(--color-success)]',
          )}
        >
          {t('comments.approve')}
        </button>
      )}

      {status !== 'SPAM' && (
        <button
          type="button"
          disabled={isBusy}
          onClick={() => run(() => setCommentStatusAction(commentId, 'SPAM'))}
          className={cn(
            buttonClass,
            'hover:border-[var(--color-warning)] hover:text-[var(--color-warning)]',
          )}
        >
          {t('comments.markSpam')}
        </button>
      )}

      <button
        type="button"
        disabled={isBusy}
        onClick={() => {
          if (window.confirm(t('confirmDelete'))) {
            run(() => deleteCommentAction(commentId));
          }
        }}
        className={cn(
          buttonClass,
          'hover:border-[var(--color-danger)] hover:text-[var(--color-danger)]',
        )}
      >
        {t('delete')}
      </button>

      {!isSelf && (
        <button
          type="button"
          disabled={isBusy}
          onClick={() => {
            if (authorBlocked || window.confirm(t('comments.confirmBlock'))) {
              run(() => setUserBlockedAction(authorId, !authorBlocked));
            }
          }}
          className={cn(
            buttonClass,
            authorBlocked
              ? 'border-[var(--color-danger)] text-[var(--color-danger)]'
              : 'hover:border-[var(--color-danger)] hover:text-[var(--color-danger)]',
          )}
        >
          {authorBlocked ? t('comments.unblock') : t('comments.block')}
        </button>
      )}
    </div>
  );
}
