import {getTranslations, setRequestLocale} from 'next-intl/server';

import {CommentModerationRow} from '@/components/admin/CommentModerationRow';
import {FormattedDate} from '@/components/ui/FormattedDate';
import {Chip} from '@/components/ui/primitives';
import type {Prisma} from '@/generated/prisma/client';
import {Link} from '@/i18n/navigation';
import {type AppLocale, toPrismaLocale} from '@/i18n/routing';
import {requireStaffForAction} from '@/lib/auth/guard';
import {db} from '@/lib/db';
import {cn} from '@/lib/utils/cn';

/**
 * Comment moderation.
 *
 * Shows every comment, including the ones readers cannot see, filtered by
 * status. The filter lives in the query string so a particular view - "what is
 * waiting for me" - is a bookmarkable URL.
 */

export const dynamic = 'force-dynamic';

/** Filters offered above the list. */
const FILTERS = [
  {key: 'pending', labelKey: 'comments.filterPending'},
  {key: 'published', labelKey: 'comments.filterPublished'},
  {key: 'spam', labelKey: 'comments.filterSpam'},
  {key: 'deleted', labelKey: 'comments.filterDeleted'},
  {key: 'all', labelKey: 'comments.filterAll'},
] as const;

/** Turns a filter key into the query that selects it. */
function filterWhere(key: string): Prisma.CommentWhereInput {
  switch (key) {
    case 'published':
      return {status: 'PUBLISHED', deletedAt: null};
    case 'spam':
      return {status: 'SPAM', deletedAt: null};
    case 'deleted':
      return {deletedAt: {not: null}};
    case 'all':
      return {};
    case 'pending':
    default:
      return {status: 'PENDING', deletedAt: null};
  }
}

/** Renders the moderation queue. */
export default async function AdminCommentsPage({
  params,
  searchParams,
}: {
  params: Promise<{locale: AppLocale}>;
  searchParams: Promise<{status?: string}>;
}) {
  const [{locale}, query] = await Promise.all([params, searchParams]);
  setRequestLocale(locale);

  const staff = await requireStaffForAction();
  const active =
    FILTERS.find((filter) => filter.key === query.status)?.key ?? 'pending';

  const prismaLocale = toPrismaLocale(locale);

  const [t, comments, counts] = await Promise.all([
    getTranslations('admin'),
    db.comment.findMany({
      where: filterWhere(active),
      orderBy: {createdAt: 'desc'},
      take: 100,
      select: {
        id: true,
        bodyHtml: true,
        status: true,
        createdAt: true,
        deletedAt: true,
        author: {
          // Deliberately no email: moderation needs to know who wrote a
          // comment and whether they are blocked, not how to contact them.
          select: {
            id: true,
            displayName: true,
            blockedAt: true,
          },
        },
        post: {
          select: {
            translations: {
              select: {locale: true, title: true, slug: true},
            },
          },
        },
        moment: {select: {id: true, body: true}},
        project: {select: {slug: true, translations: {select: {name: true}}}},
      },
    }),
    // The counts drive the filter chips, so an empty queue is visible without
    // clicking into it.
    Promise.all(
      FILTERS.map(async (filter) => ({
        key: filter.key,
        count: await db.comment.count({where: filterWhere(filter.key)}),
      })),
    ),
  ]);

  /** Describes what a comment is attached to, and links to it. */
  const describeTarget = (comment: (typeof comments)[number]) => {
    if (comment.post) {
      const translation =
        comment.post.translations.find(
          (item) => item.locale === prismaLocale,
        ) ?? comment.post.translations[0];
      return translation
        ? {label: translation.title, href: `/posts/${translation.slug}`}
        : null;
    }

    if (comment.moment) {
      return {
        label: comment.moment.body.slice(0, 40),
        href: `/moments/${comment.moment.id}`,
      };
    }

    if (comment.project) {
      return {
        label: comment.project.translations[0]?.name ?? comment.project.slug,
        href: `/projects/${comment.project.slug}`,
      };
    }

    return null;
  };

  return (
    <div className="space-y-5">
      <h2 className="font-display text-xl font-bold">{t('comments.title')}</h2>

      <nav className="flex flex-wrap gap-1.5">
        {FILTERS.map((filter) => {
          const count =
            counts.find((entry) => entry.key === filter.key)?.count ?? 0;

          return (
            <Link
              key={filter.key}
              href={`/admin/comments?status=${filter.key}`}
              className={cn(
                'rounded-lg px-3 py-1.5 text-xs font-medium transition',
                filter.key === active
                  ? 'bg-[var(--color-accent)] text-[var(--color-on-accent)]'
                  : 'bg-[var(--color-surface-sunken)] text-[var(--color-ink-muted)] hover:text-[var(--color-ink)]',
              )}
            >
              {t(filter.labelKey)}
              <span className="ml-1.5 opacity-70">{count}</span>
            </Link>
          );
        })}
      </nav>

      {comments.length === 0 ? (
        <p className="card p-8 text-center text-sm text-[var(--color-ink-muted)]">
          {t('empty')}
        </p>
      ) : (
        <ul className="card divide-y divide-[var(--color-border)]">
          {comments.map((comment) => {
            const target = describeTarget(comment);

            return (
              <li key={comment.id} className="space-y-2 p-4">
                <div className="flex flex-wrap items-center gap-2 text-xs text-[var(--color-ink-subtle)]">
                  <span className="font-medium text-[var(--color-ink)]">
                    {comment.author.displayName}
                  </span>

                  {comment.author.blockedAt && (
                    <Chip tone="neutral">{t('comments.blocked')}</Chip>
                  )}

                  {comment.status === 'PENDING' && (
                    <Chip tone="violet">{t('comments.filterPending')}</Chip>
                  )}
                  {comment.status === 'SPAM' && (
                    <Chip tone="neutral">{t('comments.filterSpam')}</Chip>
                  )}
                  {comment.deletedAt && (
                    <Chip tone="neutral">{t('comments.deletedNote')}</Chip>
                  )}

                  <FormattedDate value={comment.createdAt} variant="short" />

                  {target && (
                    <Link
                      href={target.href}
                      className="truncate transition hover:text-[var(--color-accent)]"
                    >
                      {t('comments.onPost', {title: target.label})}
                    </Link>
                  )}
                </div>

                {/* Sanitised at save time by comment-markdown.ts. */}
                <div
                  className="prose-comment"
                  dangerouslySetInnerHTML={{__html: comment.bodyHtml}}
                />

                <CommentModerationRow
                  commentId={comment.id}
                  authorId={comment.author.id}
                  authorBlocked={comment.author.blockedAt !== null}
                  status={comment.status}
                  isSelf={comment.author.id === staff.id}
                />
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
