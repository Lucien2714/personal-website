import Image from 'next/image';

import {FormattedDate} from '@/components/ui/FormattedDate';
import type {MomentView} from '@/lib/content/moments';
import {cn} from '@/lib/utils/cn';

/**
 * One entry in the moments stream.
 *
 * Moment bodies are short plain text, not Markdown, so they are rendered as
 * text with newlines preserved by CSS rather than run through the Markdown
 * pipeline. That keeps a quick note quick to publish and impossible to break
 * with a stray character.
 */
export function MomentCard({moment}: {moment: MomentView}) {
  const imageCount = moment.images.length;

  return (
    <article className="card p-5">
      <header className="mb-3 flex flex-wrap items-center gap-2 text-xs text-[var(--color-ink-subtle)]">
        {moment.mood && (
          <span
            aria-hidden="true"
            className="text-base leading-none"
            title={moment.mood}
          >
            {moment.mood}
          </span>
        )}
        <FormattedDate value={moment.createdAt} variant="short" />
        {moment.location && (
          <>
            <span aria-hidden="true">·</span>
            <span>📍 {moment.location}</span>
          </>
        )}
      </header>

      <p className="whitespace-pre-wrap text-[0.97rem] leading-relaxed">
        {moment.body}
      </p>

      {imageCount > 0 && (
        <div
          className={cn(
            'mt-4 grid gap-2',
            imageCount === 1 ? 'grid-cols-1' : 'grid-cols-2 sm:grid-cols-3',
          )}
        >
          {moment.images.map((src) => (
            <a
              key={src}
              href={src}
              target="_blank"
              rel="noopener noreferrer"
              className={cn(
                'relative block overflow-hidden rounded-xl',
                imageCount === 1 ? 'aspect-[16/10]' : 'aspect-square',
              )}
            >
              <Image
                src={src}
                alt=""
                fill
                sizes="(max-width: 640px) 50vw, 240px"
                className="object-cover transition duration-300 hover:scale-105"
              />
            </a>
          ))}
        </div>
      )}
    </article>
  );
}
