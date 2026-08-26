/**
 * The colour-theme preference, shared by the server layout and the toggle.
 *
 * The preference lives in a cookie rather than in `localStorage`. That choice
 * is what removes the blocking inline script this file replaced: the server
 * can read a cookie while rendering, so `data-theme` is already correct in the
 * first byte of HTML. There is no flash to prevent, no `dangerouslySetInnerHTML`
 * to justify, and no script for React to warn about hydrating.
 *
 * It works here specifically because every page is `force-dynamic`. On a
 * cached route the server could not vary the HTML per visitor, and the
 * script-in-head approach would be the right one again.
 */

/** Cookie holding the visitor's explicit choice. Absent means "follow the OS". */
export const THEME_COOKIE_NAME = 'pw-theme';

/** How long the preference is remembered. */
export const THEME_COOKIE_MAX_AGE_SECONDS = 60 * 60 * 24 * 365;

/**
 * The three states the toggle cycles through.
 *
 * `system` is represented by the *absence* of the cookie, so that clearing it
 * and never having set it are the same state rather than two.
 */
export type ThemePreference = 'system' | 'light' | 'dark';

/** Narrows an arbitrary string to an explicitly chosen theme. */
export function isExplicitTheme(
  value: string | undefined,
): value is 'light' | 'dark' {
  return value === 'light' || value === 'dark';
}
