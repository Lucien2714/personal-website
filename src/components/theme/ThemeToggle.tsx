'use client';

import {useSyncExternalStore} from 'react';
import {useTranslations} from 'next-intl';

import {
  THEME_COOKIE_MAX_AGE_SECONDS,
  THEME_COOKIE_NAME,
  type ThemePreference,
  isExplicitTheme,
} from '@/lib/theme';
import {cn} from '@/lib/utils/cn';

/**
 * The colour-theme toggle.
 *
 * The preference lives in a cookie, which is external state, so it is read
 * through `useSyncExternalStore` rather than copied into React state inside an
 * effect. The server has already applied the same cookie to `<html>`, so the
 * first client render agrees with the markup it is hydrating.
 *
 * A click updates two things: the `data-theme` attribute, so the change is
 * instant, and the cookie, so the *next* page load is server-rendered with it
 * and never flashes.
 */

const ORDER: ThemePreference[] = ['system', 'light', 'dark'];

/** Glyph shown for each preference. */
const GLYPHS: Record<ThemePreference, string> = {
  system: '◐',
  light: '☀',
  dark: '☾',
};

/** Subscribers notified when this tab changes the preference. */
const listeners = new Set<() => void>();

/** Registers a subscriber; returns the unsubscribe function. */
function subscribe(onChange: () => void): () => void {
  listeners.add(onChange);
  return () => {
    listeners.delete(onChange);
  };
}

/** Reads the current preference out of `document.cookie`. */
function getSnapshot(): ThemePreference {
  const match = new RegExp(`(?:^|;\\s*)${THEME_COOKIE_NAME}=([^;]*)`).exec(
    document.cookie,
  );

  const value = match?.[1];
  return isExplicitTheme(value) ? value : 'system';
}

/**
 * The value used during server rendering and hydration.
 *
 * The cookie is not readable from the server component tree here, and guessing
 * would risk a mismatch; the neutral state is the honest answer. The visible
 * theme does not depend on it - `<html data-theme>` is set by the layout.
 */
function getServerSnapshot(): ThemePreference {
  return 'system';
}

/** Applies a preference to the document and remembers it. */
function applyPreference(preference: ThemePreference): void {
  const root = document.documentElement;

  if (preference === 'system') {
    root.removeAttribute('data-theme');
    // Expiring the cookie rather than storing "system" keeps one
    // representation of that state instead of two.
    document.cookie = `${THEME_COOKIE_NAME}=; Path=/; Max-Age=0; SameSite=Lax`;
  } else {
    root.setAttribute('data-theme', preference);
    document.cookie =
      `${THEME_COOKIE_NAME}=${preference}; Path=/; ` +
      `Max-Age=${THEME_COOKIE_MAX_AGE_SECONDS}; SameSite=Lax`;
  }

  for (const listener of listeners) {
    listener();
  }
}

/** Cycles the colour theme between system, light and dark. */
export function ThemeToggle({className}: {className?: string}) {
  const t = useTranslations('nav');
  const preference = useSyncExternalStore(
    subscribe,
    getSnapshot,
    getServerSnapshot,
  );

  const handleClick = () => {
    const nextIndex = (ORDER.indexOf(preference) + 1) % ORDER.length;
    applyPreference(ORDER[nextIndex] ?? 'system');
  };

  return (
    <button
      type="button"
      onClick={handleClick}
      aria-label={t('toggleTheme')}
      title={t('toggleTheme')}
      className={cn(
        'inline-flex h-9 w-9 items-center justify-center rounded-lg',
        'border border-[var(--color-border)] bg-[var(--color-surface)]',
        'text-[var(--color-ink-muted)] transition',
        'hover:text-[var(--color-accent)] hover:border-[var(--color-accent)]',
        className,
      )}
    >
      <span aria-hidden="true" className="text-base leading-none">
        {GLYPHS[preference]}
      </span>
    </button>
  );
}
