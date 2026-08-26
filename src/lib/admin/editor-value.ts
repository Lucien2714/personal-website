import type {Locale, PublishStatus} from '@/generated/prisma/enums';

/** One language rendition held in the post editor's form state. */
export interface EditorTranslation {
  locale: Locale;
  title: string;
  slug: string;
  description: string;
  bodyMarkdown: string;
}

/** The post being edited, or blank defaults for a new one. */
export interface PostEditorValue {
  /** Present when editing, absent when creating. */
  id?: string;
  status: PublishStatus;
  /** A `datetime-local` string, or empty when unpublished. */
  publishedAt: string;
  pinned: boolean;
  coverUrl: string;
  categories: string[];
  tags: string[];
  translations: EditorTranslation[];
}

/**
 * Conversions between database rows and the shape the editor form holds.
 *
 * The editor works with a fixed pair of translations - one per locale, blank if
 * unwritten - so that switching tabs never has to create anything. The database
 * stores only the translations that exist. This module is the single place
 * where those two views are reconciled.
 */

/** Locales the editor always shows a tab for. */
const EDITOR_LOCALES: Locale[] = ['EN', 'ZH'];

/**
 * Formats a timestamp for an `<input type="datetime-local">`.
 *
 * The element expects local wall-clock time with no zone suffix, so the UTC
 * value is shifted by the runtime's offset before being trimmed.
 */
export function toDateTimeLocal(value: Date | null): string {
  if (!value) {
    return '';
  }

  const offsetMs = value.getTimezoneOffset() * 60_000;
  return new Date(value.getTime() - offsetMs).toISOString().slice(0, 16);
}

/** A post row, selected with the fields the editor needs. */
export interface EditablePostRow {
  id: string;
  status: PostEditorValue['status'];
  publishedAt: Date | null;
  pinned: boolean;
  coverUrl: string | null;
  categories: Array<{names: unknown}>;
  tags: Array<{names: unknown}>;
  translations: Array<{
    locale: Locale;
    title: string;
    slug: string;
    description: string | null;
    bodyMarkdown: string;
  }>;
}

/** Reads a display name out of a `names` JSON column. */
function displayName(names: unknown): string {
  if (names && typeof names === 'object' && !Array.isArray(names)) {
    const first = Object.values(names as Record<string, unknown>).find(
      (value): value is string => typeof value === 'string',
    );
    return first ?? '';
  }
  return '';
}

/** Builds the form state for an existing post. */
export function toEditorValue(row: EditablePostRow): PostEditorValue {
  const translations: EditorTranslation[] = EDITOR_LOCALES.map((locale) => {
    const existing = row.translations.find((item) => item.locale === locale);

    return {
      locale,
      title: existing?.title ?? '',
      slug: existing?.slug ?? '',
      description: existing?.description ?? '',
      bodyMarkdown: existing?.bodyMarkdown ?? '',
    };
  });

  // The language the author actually wrote in should be the tab that opens.
  translations.sort((left, right) => {
    const leftWritten = left.title.length > 0 ? 0 : 1;
    const rightWritten = right.title.length > 0 ? 0 : 1;
    return leftWritten - rightWritten;
  });

  return {
    id: row.id,
    status: row.status,
    publishedAt: toDateTimeLocal(row.publishedAt),
    pinned: row.pinned,
    coverUrl: row.coverUrl ?? '',
    categories: row.categories
      .map((category) => displayName(category.names))
      .filter((name) => name.length > 0),
    tags: row.tags
      .map((tag) => displayName(tag.names))
      .filter((name) => name.length > 0),
    translations,
  };
}

/** Builds the form state for a brand-new post. */
export function emptyEditorValue(): PostEditorValue {
  return {
    status: 'DRAFT',
    publishedAt: '',
    pinned: false,
    coverUrl: '',
    categories: [],
    tags: [],
    translations: EDITOR_LOCALES.map((locale) => ({
      locale,
      title: '',
      slug: '',
      description: '',
      bodyMarkdown: '',
    })),
  };
}
