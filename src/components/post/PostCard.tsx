import Image from 'next/image';
import {useTranslations} from 'next-intl';

import {FormattedDate} from '@/components/ui/FormattedDate';
import {Chip} from '@/components/ui/primitives';
import {Link} from '@/i18n/navigation';
import type {PostSummary} from '@/lib/content/posts';
import {cn} from '@/lib/utils/cn';

/**
 * One post in an index listing.
 *
 * The whole card is a single link with the cover image marked decorative, so
 * a screen reader announces one target ("post title, link") instead of three.
 */
export function PostCard({
  post,
  /** Compact cards drop the cover image and description. */
  compact = false,
}: {
  post: PostSummary;
  compact?: boolean;
}) {
  const t = useTranslations('post');

  return (
    <article
      className={cn(
        'card card-interactive group relative overflow-hidden',
        compact ? 'p-4' : 'p-0',
      )}
    >
      {!compact && post.coverUrl && (
        <div className="relative aspect-[2/1] w-full overflow-hidden">
          <Image
            src={post.coverUrl}
            alt=""
            fill
            sizes="(max-width: 768px) 100vw, 720px"
            className="object-cover transition duration-500 group-hover:scale-[1.03]"
          />
        </div>
      )}

      <div className={cn(compact ? '' : 'p-5 sm:p-6')}>
        <div className="mb-2 flex flex-wrap items-center gap-2 text-xs text-[var(--color-ink-subtle)]">
          {post.pinned && <Chip tone="lavender">{t('pinned')}</Chip>}
          {post.publishedAt && (
            <FormattedDate value={post.publishedAt} variant="short" />
          )}
          <span aria-hidden="true">·</span>
          <span>{t('readingTime', {minutes: post.readingMinutes})}</span>
        </div>

        <h3
          className={cn(
            'font-display font-bold leading-snug',
            compact ? 'text-base' : 'text-xl sm:text-[1.35rem]',
          )}
        >
          <Link
            href={`/posts/${post.slug}`}
            // Stretching the link over the card keeps the large click target
            // without nesting interactive elements inside one another.
            className="after:absolute after:inset-0 after:content-[''] group-hover:text-[var(--color-sakura)]"
          >
            {post.title}
          </Link>
        </h3>

        {!compact && post.description && (
          <p className="mt-2 line-clamp-3 text-sm leading-relaxed text-[var(--color-ink-muted)]">
            {post.description}
          </p>
        )}

        {!compact && (post.categories.length > 0 || post.tags.length > 0) && (
          <div className="mt-4 flex flex-wrap gap-1.5">
            {post.categories.map((category) => (
              <Chip key={category.slug} tone="sky">
                {category.name}
              </Chip>
            ))}
            {post.tags.slice(0, 4).map((tag) => (
              <Chip key={tag.slug} tone="neutral">
                #{tag.name}
              </Chip>
            ))}
          </div>
        )}
      </div>
    </article>
  );
}
