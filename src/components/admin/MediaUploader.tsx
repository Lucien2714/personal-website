'use client';

import {type DragEvent, useRef, useState, useTransition} from 'react';
import {useRouter} from 'next/navigation';
import {useTranslations} from 'next-intl';

import {uploadImageAction} from '@/app/[locale]/admin/(console)/moments/actions';
import {cn} from '@/lib/utils/cn';

/**
 * A drop target for uploading images to the media library.
 *
 * The same server action backs this and the moments composer, so both paths
 * apply identical type and size checks and produce identical rows.
 */
export function MediaUploader() {
  const t = useTranslations('admin');
  const router = useRouter();
  const fileInput = useRef<HTMLInputElement>(null);

  const [isDragging, setDragging] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isUploading, startUploading] = useTransition();

  const upload = (files: FileList | null) => {
    if (!files || files.length === 0) {
      return;
    }
    setError(null);

    startUploading(async () => {
      for (const file of files) {
        const formData = new FormData();
        formData.set('file', file);
        const result = await uploadImageAction(formData);

        if (!result.ok) {
          setError(result.message);
          break;
        }
      }
      router.refresh();
    });
  };

  const handleDrop = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setDragging(false);
    upload(event.dataTransfer.files);
  };

  return (
    <div className="space-y-2">
      {/* The div is a drop target; the button inside it is the keyboard and
          screen-reader path to the same action. */}
      <div
        onDragOver={(event) => {
          event.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={handleDrop}
        className={cn(
          'flex flex-col items-center gap-3 rounded-2xl border-2 border-dashed px-6 py-10 text-center transition',
          isDragging
            ? 'border-[var(--color-accent)] bg-[var(--color-accent-soft)]'
            : 'border-[var(--color-border-strong)] bg-[var(--color-surface)]',
          isUploading && 'opacity-60',
        )}
      >
        <span aria-hidden="true" className="text-3xl">
          🖼
        </span>
        <p className="text-sm text-[var(--color-ink-muted)]">
          {t('dropToUpload')}
        </p>

        <input
          ref={fileInput}
          type="file"
          accept="image/*"
          multiple
          hidden
          onChange={(event) => {
            upload(event.target.files);
            event.target.value = '';
          }}
        />

        <button
          type="button"
          onClick={() => fileInput.current?.click()}
          disabled={isUploading}
          className="rounded-lg bg-[var(--color-accent)] px-4 py-2 text-sm font-semibold text-[var(--color-on-accent)] transition hover:opacity-90 disabled:opacity-60"
        >
          {isUploading ? t('saving') : t('uploadImage')}
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
