import {createNavigation} from 'next-intl/navigation';

import {routing} from '@/i18n/routing';

/**
 * Locale-aware replacements for the Next.js navigation primitives.
 *
 * Importing `Link` from here rather than from `next/link` means a href of
 * `/posts` resolves to `/zh/posts` for a reader browsing in Chinese, without
 * any call site having to thread the locale through.
 */
export const {Link, redirect, usePathname, useRouter, getPathname} =
  createNavigation(routing);
