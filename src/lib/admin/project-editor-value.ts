import type {Locale, PublishStatus} from '@/generated/prisma/enums';

/**
 * Form state for the project editor.
 *
 * These live outside the editor component on purpose. A module marked
 * `'use client'` exports client references, not plain functions: a server
 * component that imports one and calls it gets "attempted to call X from the
 * server". Keeping the shape and its factory here lets the server render the
 * initial value and pass it down as a prop, which is what the client component
 * actually needs.
 */

/** Statuses a project can be in, as the editor sees them. */
export type ProjectStatus = Extract<
  PublishStatus,
  'DRAFT' | 'PUBLISHED' | 'ARCHIVED'
>;

/** One language rendition held in form state. */
export interface ProjectEditorTranslation {
  locale: Locale;
  name: string;
  summary: string;
  bodyMarkdown: string;
}

/**
 * The project being edited.
 *
 * Numeric fields are held as strings because that is what an `<input>` gives
 * back; they are parsed once, on save.
 */
export interface ProjectEditorValue {
  id?: string;
  slug: string;
  status: ProjectStatus;
  repoUrl: string;
  liveUrl: string;
  embedUrl: string;
  embedHeight: string;
  coverUrl: string;
  techStack: string[];
  sortOrder: string;
  featured: boolean;
  translations: ProjectEditorTranslation[];
}

/** Locales the editor always shows a tab for. */
export const PROJECT_EDITOR_LOCALES: Locale[] = ['EN', 'ZH'];

/** Builds blank form state for a new project. */
export function emptyProjectValue(): ProjectEditorValue {
  return {
    slug: '',
    status: 'PUBLISHED',
    repoUrl: '',
    liveUrl: '',
    embedUrl: '',
    embedHeight: '',
    coverUrl: '',
    techStack: [],
    sortOrder: '0',
    featured: false,
    translations: PROJECT_EDITOR_LOCALES.map((locale) => ({
      locale,
      name: '',
      summary: '',
      bodyMarkdown: '',
    })),
  };
}
