'use client';

import {useRouter} from 'next/navigation';
import {useState, useTransition} from 'react';
import {useTranslations} from 'next-intl';

import {
  type CommentErrorKey,
  createCommentAction,
  editCommentAction,
} from '@/lib/actions/comments';
import {COMMENT_MAX_LENGTH} from '@/lib/content/comment-markdown';
import type {CommentTarget} from '@/lib/content/comments';
import {cn} from '@/lib/utils/cn';

/**
 * The comment composer.
 *
 * One component serves three jobs - a new comment, a reply, and an edit -
 * because the differences between them are which action runs and what the
 * textarea starts with. Three near-identical components would drift.
 *
 * There is no live preview. The comment renderer permits so little markup that
 * a preview pane would mostly show the text back unchanged, at the cost of a
 * server round trip per keystroke; the hint under the box does the same work.
 */

/** Shared class list for the textarea. */
const TEXTAREA_CLASS =
  'w-full resize-y rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-3.5 py-3 text-sm outline-none transition focus:border-[var(--color-accent)]';

/** Props accepted by {@link CommentForm}. */
export interface CommentFormProps {
  /** What is being commented on. Required unless editing. */
  target?: CommentTarget;
  /** Set when replying; the comment being replied to. */
  parentId?: string;
  /** Name shown in the "replying to" line. */
  replyingToName?: string;
  /** Set when editing an existing comment. */
  editingId?: string;
  /** Initial contents, used when editing. */
  initialBody?: string;
  /** Called when the reader abandons a reply or an edit. */
  onCancel?: () => void;
  /** Called after a successful save. */
  onDone?: () => void;
  autoFocus?: boolean;
}

/** Renders the composer. */
export function CommentForm({
  target,
  parentId,
  replyingToName,
  editingId,
  initialBody = '',
  onCancel,
  onDone,
  autoFocus = false,
}: CommentFormProps) {
  const t = useTranslations('comments');
  const router = useRouter();

  const [body, setBody] = useState(initialBody);
  const [errorKey, setErrorKey] = useState<CommentErrorKey | null>(null);
  const [notice, setNotice] = useState<'posted' | 'pending' | null>(null);
  const [isSaving, startSaving] = useTransition();

  const remaining = COMMENT_MAX_LENGTH - body.length;
  const canSubmit = body.trim().length > 0 && remaining >= 0 && !isSaving;

  const handleSubmit = () => {
    setErrorKey(null);
    setNotice(null);

    startSaving(async () => {
      const result = editingId
        ? await editCommentAction({id: editingId, body})
        : await createCommentAction({
            target,
            parentId: parentId ?? null,
            body,
          });

      if (!result.ok) {
        setErrorKey(result.errorKey);
        return;
      }

      if (!editingId) {
        setBody('');
      }

      // A pending comment will not appear in the list, so say so explicitly
      // rather than leaving the reader wondering where it went.
      setNotice(result.status === 'PENDING' ? 'pending' : 'posted');

      router.refresh();
      onDone?.();
    });
  };

  return (
    <div className="space-y-2">
      {replyingToName && (
        <p className="text-xs text-[var(--color-ink-subtle)]">
          {t('replyingTo', {name: replyingToName})}
        </p>
      )}

      <textarea
        value={body}
        rows={editingId || parentId ? 3 : 4}
        autoFocus={autoFocus}
        placeholder={t('placeholder')}
        onChange={(event) => setBody(event.target.value)}
        className={TEXTAREA_CLASS}
      />

      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <p className="text-xs text-[var(--color-ink-subtle)]">
          {t('markdownHint')}
        </p>

        <span
          className={cn(
            'ml-auto text-xs tabular-nums',
            remaining < 0
              ? 'text-[var(--color-danger)]'
              : 'text-[var(--color-ink-subtle)]',
          )}
        >
          {t('remaining', {count: remaining})}
        </span>

        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            className="rounded-lg border border-[var(--color-border)] px-3 py-1.5 text-xs font-medium text-[var(--color-ink-muted)] transition hover:text-[var(--color-ink)]"
          >
            {t('cancel')}
          </button>
        )}

        <button
          type="button"
          onClick={handleSubmit}
          disabled={!canSubmit}
          className="rounded-lg bg-[var(--color-accent)] px-4 py-1.5 text-sm font-semibold text-[var(--color-on-accent)] transition hover:opacity-90 disabled:opacity-50"
        >
          {isSaving ? t('submitting') : editingId ? t('save') : t('submit')}
        </button>
      </div>

      {errorKey && (
        <p role="alert" className="text-sm text-[var(--color-danger)]">
          {t(`error.${errorKey}`)}
        </p>
      )}

      {notice && (
        <p role="status" className="text-sm text-[var(--color-success)]">
          {t(notice)}
        </p>
      )}
    </div>
  );
}
