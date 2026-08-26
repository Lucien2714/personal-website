import Image from 'next/image';
import {getTranslations, setRequestLocale} from 'next-intl/server';

import {deleteMediaAction} from '@/app/[locale]/admin/(console)/media/actions';
import {CopyButton} from '@/components/admin/CopyButton';
import {DeleteButton} from '@/components/admin/DeleteButton';
import {MediaUploader} from '@/components/admin/MediaUploader';
import {FormattedDate} from '@/components/ui/FormattedDate';
import type {AppLocale} from '@/i18n/routing';
import {db} from '@/lib/db';
import {mediaUrl} from '@/lib/media/storage';

/** The media library. */

export const dynamic = 'force-dynamic';

/** Formats a byte count for display. */
function formatBytes(bytes: number): string {
  if (bytes < 1024) {
    return `${bytes} B`;
  }
  if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(0)} KB`;
  }
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

/** Renders the uploader and the gallery. */
export default async function AdminMediaPage({
  params,
}: {
  params: Promise<{locale: AppLocale}>;
}) {
  const {locale} = await params;
  setRequestLocale(locale);

  const [t, files] = await Promise.all([
    getTranslations('admin'),
    db.media.findMany({
      orderBy: {createdAt: 'desc'},
      take: 120,
      select: {
        id: true,
        storageKey: true,
        originalName: true,
        mimeType: true,
        byteSize: true,
        createdAt: true,
      },
    }),
  ]);

  return (
    <div className="space-y-5">
      <h2 className="font-display text-xl font-bold">{t('media')}</h2>

      <MediaUploader />

      {files.length === 0 ? (
        <p className="card p-8 text-center text-sm text-[var(--color-ink-muted)]">
          {t('empty')}
        </p>
      ) : (
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {files.map((file) => {
            const url = mediaUrl(file.storageKey);

            return (
              <li key={file.id} className="card overflow-hidden">
                <div className="relative aspect-square bg-[var(--color-surface-sunken)]">
                  <Image
                    src={url}
                    alt={file.originalName}
                    fill
                    sizes="(max-width: 640px) 50vw, 220px"
                    className="object-cover"
                  />
                </div>

                <div className="space-y-2 p-2.5">
                  <p
                    className="truncate text-xs font-medium"
                    title={file.originalName}
                  >
                    {file.originalName}
                  </p>
                  <p className="flex items-center justify-between text-[0.68rem] text-[var(--color-ink-subtle)]">
                    <span>{formatBytes(file.byteSize)}</span>
                    <FormattedDate value={file.createdAt} variant="short" />
                  </p>
                  <div className="flex items-center gap-1.5">
                    <CopyButton value={url} />
                    <DeleteButton id={file.id} action={deleteMediaAction} />
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
