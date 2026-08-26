import type {Locale, PublishStatus} from '@/generated/prisma/enums';

/**
 * Form state for the standalone-page editor.
 *
 * Kept out of the `'use client'` component for the same reason as
 * {@link ../admin/project-editor-value.ts}: a server component cannot call a
 * function that lives in a client module, so the factory has to sit in a plain
 * one.
 */

/** Statuses a page can be in. */
export type PageStatus = Extract<
  PublishStatus,
  'DRAFT' | 'PUBLISHED' | 'ARCHIVED'
>;

/** One language rendition held in form state. */
export interface PageEditorTranslation {
  locale: Locale;
  title: string;
  bodyMarkdown: string;
}

/** The page being edited. */
export interface PageEditorValue {
  /** Absent for a new page. An existing page's slug cannot be changed. */
  originalSlug?: string;
  slug: string;
  status: PageStatus;
  /** Empty string means "hidden from the navigation". */
  navOrder: string;
  icon: string;
  translations: PageEditorTranslation[];
}

/** Locales the editor always shows a tab for. */
export const PAGE_EDITOR_LOCALES: Locale[] = ['EN', 'ZH'];

/** Builds blank form state for a new page. */
export function emptyPageValue(): PageEditorValue {
  return {
    slug: '',
    status: 'PUBLISHED',
    navOrder: '',
    icon: '',
    translations: PAGE_EDITOR_LOCALES.map((locale) => ({
      locale,
      title: '',
      bodyMarkdown: '',
    })),
  };
}
