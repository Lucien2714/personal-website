/**
 * Applies the stored theme before the first paint.
 *
 * A React effect would run after hydration, which is too late: the page would
 * render light, then flip to dark, and the reader would see a flash. This tiny
 * script runs synchronously in <head>, so `data-theme` is already on <html>
 * when the browser computes the first frame.
 *
 * It is intentionally written as a string rather than a component body,
 * because it must execute before any bundle is downloaded.
 */

/** localStorage key holding the visitor's explicit theme choice. */
export const THEME_STORAGE_KEY = 'pw-theme';

const INLINE_SCRIPT = `
(function () {
  try {
    var stored = localStorage.getItem('${THEME_STORAGE_KEY}');
    if (stored === 'light' || stored === 'dark') {
      document.documentElement.setAttribute('data-theme', stored);
    }
  } catch (error) {
    // Private browsing modes can throw on localStorage access. Falling
    // through leaves the CSS media query in charge, which is a fine default.
  }
})();
`;

/** Renders the blocking theme script. Place it inside <head>. */
export function ThemeScript() {
  return (
    <script
      // The content is a compile-time constant with no interpolation of user
      // data, which is what makes this use of the escape hatch safe.
      dangerouslySetInnerHTML={{__html: INLINE_SCRIPT}}
      suppressHydrationWarning
    />
  );
}
