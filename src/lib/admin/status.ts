import type {PublishStatus} from '@/generated/prisma/enums';

/**
 * Presentation helpers for publication status.
 *
 * Kept in one place because three screens (dashboard, post list, editor) all
 * need to turn a `PublishStatus` into a label and a colour, and three copies of
 * a switch statement is three chances to forget a case when the enum grows.
 */

/** Translation keys, relative to the `admin` namespace. */
const MESSAGE_KEYS = {
  DRAFT: 'statusDraft',
  SCHEDULED: 'statusScheduled',
  PUBLISHED: 'statusPublished',
  ARCHIVED: 'statusArchived',
} as const satisfies Record<PublishStatus, string>;

/** Chip tones matching each status. */
const TONES = {
  DRAFT: 'neutral',
  SCHEDULED: 'lavender',
  PUBLISHED: 'mint',
  ARCHIVED: 'neutral',
} as const satisfies Record<PublishStatus, 'neutral' | 'lavender' | 'mint'>;

/** The `admin` namespace key that labels a status. */
export function statusMessageKey(
  status: PublishStatus,
): (typeof MESSAGE_KEYS)[PublishStatus] {
  return MESSAGE_KEYS[status];
}

/** The chip tone that should be used for a status. */
export function statusTone(
  status: PublishStatus,
): (typeof TONES)[PublishStatus] {
  return TONES[status];
}
