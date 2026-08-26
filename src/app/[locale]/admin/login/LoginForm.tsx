'use client';

import {useActionState} from 'react';
import {useFormStatus} from 'react-dom';
import {useTranslations} from 'next-intl';

import {
  type SignInState,
  signInAction,
} from '@/app/[locale]/admin/login/actions';
import type {AppLocale} from '@/i18n/routing';

/**
 * The sign-in form.
 *
 * Built on `useActionState` so that the credentials are posted to a server
 * action rather than to a client-side fetch: the password never becomes part
 * of a client bundle's control flow, and the form still works if the page's
 * JavaScript has not loaded yet.
 */

const INITIAL_STATE: SignInState = {errorKey: null};

/** The submit button, disabled while the action is in flight. */
function SubmitButton() {
  const t = useTranslations('auth');
  const {pending} = useFormStatus();

  return (
    <button
      type="submit"
      disabled={pending}
      className="w-full rounded-lg bg-[var(--color-accent)] px-5 py-2.5 text-sm font-semibold text-[var(--color-on-accent)] transition hover:opacity-90 disabled:opacity-60"
    >
      {pending ? t('submitting') : t('submit')}
    </button>
  );
}

/** Renders the sign-in form. */
export function LoginForm({
  locale,
  next,
}: {
  locale: AppLocale;
  /** Path to return to after a successful sign-in. */
  next?: string;
}) {
  const t = useTranslations('auth');
  const [state, formAction] = useActionState(signInAction, INITIAL_STATE);

  return (
    <form action={formAction} className="space-y-4">
      <input type="hidden" name="locale" value={locale} />
      {next && <input type="hidden" name="next" value={next} />}

      <div className="space-y-1.5">
        <label
          htmlFor="email"
          className="block text-sm font-medium text-[var(--color-ink-muted)]"
        >
          {t('email')}
        </label>
        <input
          id="email"
          name="email"
          type="email"
          required
          autoComplete="username"
          autoFocus
          className="w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] px-3.5 py-2.5 text-sm outline-none transition focus:border-[var(--color-accent)]"
        />
      </div>

      <div className="space-y-1.5">
        <label
          htmlFor="password"
          className="block text-sm font-medium text-[var(--color-ink-muted)]"
        >
          {t('password')}
        </label>
        <input
          id="password"
          name="password"
          type="password"
          required
          autoComplete="current-password"
          className="w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] px-3.5 py-2.5 text-sm outline-none transition focus:border-[var(--color-accent)]"
        />
      </div>

      {state.errorKey && (
        <p
          role="alert"
          className="rounded-xl bg-[var(--color-accent-soft)] px-3.5 py-2.5 text-sm text-[var(--color-danger)]"
        >
          {t(state.errorKey)}
        </p>
      )}

      <SubmitButton />
    </form>
  );
}
