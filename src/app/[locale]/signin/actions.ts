'use server';

import {redirect} from 'next/navigation';

import {isAppLocale} from '@/i18n/routing';
import {destroySession} from '@/lib/auth/session';

/** Sign-out for readers. */

/** Reads a text field out of a form, treating a File as absent. */
function readTextField(formData: FormData, name: string): string {
  const value = formData.get(name);
  return typeof value === 'string' ? value : '';
}

/**
 * Signs the current reader out and returns them to where they were.
 *
 * Distinct from the console's sign-out only in where it lands afterwards: a
 * reader who signs out on an article should stay on that article.
 *
 * @param formData Carries the locale and the path to return to.
 */
export async function readerSignOutAction(formData: FormData): Promise<void> {
  const requestedLocale = readTextField(formData, 'locale');
  const locale = isAppLocale(requestedLocale) ? requestedLocale : 'en';
  const next = readTextField(formData, 'next');

  await destroySession();

  // Only same-site paths are honoured, so a crafted field cannot turn the
  // sign-out button into an open redirect.
  redirect(
    next.startsWith('/') && !next.startsWith('//') ? next : `/${locale}`,
  );
}
