'use client';

import {useSyncExternalStore} from 'react';
import {useTranslations} from 'next-intl';

import {THEME_STORAGE_KEY} from '@/components/theme/ThemeScript';
import {cn} from '@/lib/utils/cn';

/**
 * The colour-theme toggle.
 *
 * The stored preference lives in `localStorage`, which is external state, so
 * it is read through `useSyncExternalStore` rather than copied into React
 * state inside an effect. That matters for two reasons: the server render and
 * the first client render agree (both report "system"), and a change made in
 * another tab reaches this one through the `storage` event instead of going
 * unnoticed.
 */

/** The three states the toggle cycles through. */
type ThemePreference = 'system' | 'light' | 'dark';

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
  // `storage` fires only in *other* tabs, which is why same-tab changes are
  // published through the local listener set as well.
  window.addEventListener('storage', onChange);

  return () => {
    listeners.delete(onChange);
    window.removeEventListener('storage', onChange);
  };
}

/** Reads the current preference from storage. */
function getSnapshot(): ThemePreference {
  try {
    const stored = localStorage.getItem(THEME_STORAGE_KEY);
    return stored === 'light' || stored === 'dark' ? stored : 'system';
  } catch {
    // Private browsing can throw on access; following the system is a fine
    // answer in that case.
    return 'system';
  }
}

/**
 * The value used during server rendering and hydration.
 *
 * It has to be a constant: the server cannot know what a given browser has
 * stored, and returning anything else here would guarantee a mismatch.
 */
function getServerSnapshot(): ThemePreference {
  return 'system';
}

/** Writes the preference to `<html>` and to storage, then notifies React. */
function applyPreference(preference: ThemePreference): void {
  const root = document.documentElement;
  if (preference === 'system') {
    root.removeAttribute('data-theme');
  } else {
    root.setAttribute('data-theme', preference);
  }

  try {
    if (preference === 'system') {
      localStorage.removeItem(THEME_STORAGE_KEY);
    } else {
      localStorage.setItem(THEME_STORAGE_KEY, preference);
    }
  } catch {
    // The theme still applies to this page view; it just will not persist.
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
