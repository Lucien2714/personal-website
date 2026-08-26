'use client';

import Image from 'next/image';
import {useRouter} from 'next/navigation';
import {useRef, useState, useTransition} from 'react';
import {useTranslations} from 'next-intl';

import {
  saveMomentAction,
  uploadImageAction,
} from '@/app/[locale]/admin/(console)/moments/actions';
import {cn} from '@/lib/utils/cn';

/**
 * The moments composer.
 *
 * Kept to a single textarea, a mood, a place and a few images, because the
 * whole value of a moment is that posting one takes a few seconds. Anything
 * that needs more structure than this is a post.
 */

/** Moods offered as one-click options. */
const MOODS = ['😊', '😪', '🔥', '🎮', '☕️', '🌧', '🎉', '🤔'] as const;

/** Maximum number of images one moment may carry. */
const MAX_IMAGES = 9;

/** Renders the composer. */
export function MomentComposer() {
  const t = useTranslations('admin');
  const router = useRouter();
  const fileInput = useRef<HTMLInputElement>(null);

  const [body, setBody] = useState('');
  const [mood, setMood] = useState('');
  const [location, setLocation] = useState('');
  const [images, setImages] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isBusy, startBusy] = useTransition();

  const handleFiles = (files: FileList | null) => {
    if (!files || files.length === 0) {
      return;
    }

    const room = MAX_IMAGES - images.length;
    const selected = [...files].slice(0, room);

    startBusy(async () => {
      const uploaded: string[] = [];
      for (const file of selected) {
        const formData = new FormData();
        formData.set('file', file);
        const result = await uploadImageAction(formData);

        if (!result.ok) {
          setError(result.message);
          break;
        }
        uploaded.push(result.url);
      }

      if (uploaded.length > 0) {
        setImages((current) => [...current, ...uploaded]);
      }
    });
  };

  const handleSubmit = () => {
    setError(null);

    startBusy(async () => {
      const result = await saveMomentAction({
        body,
        mood: mood || undefined,
        location: location || undefined,
        images,
      });

      if (!result.ok) {
        setError(result.message ?? 'Save failed.');
        return;
      }

      setBody('');
      setMood('');
      setLocation('');
      setImages([]);
      router.refresh();
    });
  };

  return (
    <div className="card space-y-3 p-5">
      <textarea
        value={body}
        rows={3}
        placeholder={t('newMoment')}
        onChange={(event) => setBody(event.target.value)}
        className="w-full resize-y rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] px-3.5 py-3 text-sm outline-none transition focus:border-[var(--color-accent)]"
      />

      {images.length > 0 && (
        <ul className="flex flex-wrap gap-2">
          {images.map((url) => (
            <li
              key={url}
              className="relative h-20 w-20 overflow-hidden rounded-xl"
            >
              <Image
                src={url}
                alt=""
                fill
                sizes="80px"
                className="object-cover"
              />
              <button
                type="button"
                onClick={() =>
                  setImages((current) => current.filter((item) => item !== url))
                }
                aria-label="Remove image"
                className="absolute right-1 top-1 flex h-5 w-5 items-center justify-center rounded-full bg-black/60 text-xs text-white"
              >
                ×
              </button>
            </li>
          ))}
        </ul>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <div className="flex flex-wrap gap-1" role="group" aria-label="Mood">
          {MOODS.map((option) => (
            <button
              key={option}
              type="button"
              aria-pressed={mood === option}
              onClick={() => setMood(mood === option ? '' : option)}
              className={cn(
                'h-8 w-8 rounded-lg text-base transition',
                mood === option
                  ? 'bg-[var(--color-accent-soft)] ring-2 ring-[var(--color-accent)]'
                  : 'hover:bg-[var(--color-surface-sunken)]',
              )}
            >
              {option}
            </button>
          ))}
        </div>

        <input
          value={location}
          placeholder="📍"
          onChange={(event) => setLocation(event.target.value)}
          className="w-28 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-1.5 text-xs outline-none focus:border-[var(--color-accent)]"
        />

        <input
          ref={fileInput}
          type="file"
          accept="image/*"
          multiple
          hidden
          onChange={(event) => {
            handleFiles(event.target.files);
            // Clearing the value allows the same file to be picked twice.
            event.target.value = '';
          }}
        />

        <button
          type="button"
          onClick={() => fileInput.current?.click()}
          disabled={isBusy || images.length >= MAX_IMAGES}
          className="rounded-lg border border-[var(--color-border)] px-3 py-1.5 text-xs font-medium transition hover:border-[var(--color-accent)] disabled:opacity-50"
        >
          🖼 {t('uploadImage')}
        </button>

        <button
          type="button"
          onClick={handleSubmit}
          disabled={isBusy || body.trim().length === 0}
          className="ml-auto rounded-lg bg-[var(--color-accent)] px-5 py-2 text-sm font-semibold text-[var(--color-on-accent)] transition hover:opacity-90 disabled:opacity-60"
        >
          {isBusy ? t('saving') : t('publish')}
        </button>
      </div>

      {error && (
        <p role="alert" className="text-sm text-[var(--color-danger)]">
          {error}
        </p>
      )}
    </div>
  );
}
