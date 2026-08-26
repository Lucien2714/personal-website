import {createHash} from 'node:crypto';
import {mkdir, unlink, writeFile} from 'node:fs/promises';
import path from 'node:path';

import {db} from '@/lib/db';
import {env} from '@/lib/env';

/**
 * Storage for uploaded media.
 *
 * Files are written to `UPLOAD_DIR` (a Docker volume in production) and
 * indexed in the `media` table. The database never holds the bytes: a row is
 * small enough to back up nightly, while a few hundred megabytes of images
 * are better served by the filesystem and a volume snapshot.
 *
 * Uploads are content-addressed by SHA-256, so re-uploading the same image
 * returns the existing row instead of a second copy.
 */

/** Image and document types the console accepts. */
const ALLOWED_MIME_TYPES = new Map<string, string>([
  ['image/png', 'png'],
  ['image/jpeg', 'jpg'],
  ['image/gif', 'gif'],
  ['image/webp', 'webp'],
  ['image/avif', 'avif'],
  ['image/svg+xml', 'svg'],
]);

/** Why an upload was rejected. */
export type UploadRejection =
  'unsupported_type' | 'too_large' | 'empty' | 'write_failed';

/** The outcome of an upload attempt. */
export type UploadResult =
  | {
      ok: true;
      id: string;
      /** Public URL, ready to paste into Markdown. */
      url: string;
      /** True when an identical file was already stored. */
      deduplicated: boolean;
    }
  | {ok: false; reason: UploadRejection; message: string};

/** Strips anything that could escape the upload directory or confuse a shell. */
function safeBaseName(originalName: string): string {
  const base = path.basename(originalName, path.extname(originalName));
  const cleaned = base
    .toLowerCase()
    .replace(/[^a-z0-9一-鿿-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48);

  return cleaned.length > 0 ? cleaned : 'file';
}

/** The public URL for a stored key. */
export function mediaUrl(storageKey: string): string {
  return `/uploads/${storageKey}`;
}

/**
 * Stores an uploaded file.
 *
 * @param file The uploaded file, as delivered by `FormData`.
 * @param uploaderId The account credited with the upload.
 * @param altText Optional alternative text.
 */
export async function storeUpload(
  file: File,
  uploaderId: string,
  altText?: string,
): Promise<UploadResult> {
  if (file.size === 0) {
    return {ok: false, reason: 'empty', message: 'The file is empty.'};
  }

  if (file.size > env.UPLOAD_MAX_BYTES) {
    return {
      ok: false,
      reason: 'too_large',
      message: `Files must be ${Math.floor(env.UPLOAD_MAX_BYTES / 1024 / 1024)} MB or smaller.`,
    };
  }

  const extension = ALLOWED_MIME_TYPES.get(file.type);
  if (!extension) {
    return {
      ok: false,
      reason: 'unsupported_type',
      message: `Unsupported file type: ${file.type || 'unknown'}.`,
    };
  }

  const bytes = Buffer.from(await file.arrayBuffer());
  const checksum = createHash('sha256').update(bytes).digest('hex');

  // An identical upload already on disk needs no second copy.
  const existing = await db.media.findFirst({
    where: {checksum},
    select: {id: true, storageKey: true},
  });
  if (existing) {
    return {
      ok: true,
      id: existing.id,
      url: mediaUrl(existing.storageKey),
      deduplicated: true,
    };
  }

  // Date-based directories keep any single directory small enough to list.
  const now = new Date();
  const folder = `${now.getFullYear()}/${String(now.getMonth() + 1).padStart(2, '0')}`;
  const storageKey = `${folder}/${safeBaseName(file.name)}-${checksum.slice(0, 8)}.${extension}`;
  const destination = path.join(env.UPLOAD_DIR, storageKey);

  try {
    await mkdir(path.dirname(destination), {recursive: true});
    await writeFile(destination, bytes);
  } catch (error) {
    console.error('[media] failed to write upload', error);
    return {
      ok: false,
      reason: 'write_failed',
      message: 'The file could not be written to disk.',
    };
  }

  const record = await db.media.create({
    data: {
      uploaderId,
      storageKey,
      originalName: file.name.slice(0, 255),
      mimeType: file.type,
      byteSize: bytes.byteLength,
      altText: altText ?? null,
      checksum,
    },
    select: {id: true},
  });

  return {
    ok: true,
    id: record.id,
    url: mediaUrl(storageKey),
    deduplicated: false,
  };
}

/**
 * Deletes a stored file and its index row.
 *
 * The row is removed even when the file is already missing from disk: leaving
 * an index entry that points at nothing would be worse than an orphaned file.
 *
 * @param id Identifier of the media row.
 */
export async function deleteMedia(id: string): Promise<void> {
  const record = await db.media.findUnique({
    where: {id},
    select: {storageKey: true},
  });

  if (!record) {
    return;
  }

  try {
    await unlink(path.join(env.UPLOAD_DIR, record.storageKey));
  } catch {
    // Already gone, or never written; the row still needs to go.
  }

  await db.media.delete({where: {id}});
}
