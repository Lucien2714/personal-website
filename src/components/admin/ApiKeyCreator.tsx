'use client';

import {useRouter} from 'next/navigation';
import {useState, useTransition} from 'react';
import {useTranslations} from 'next-intl';

import {createApiKeyAction} from '@/app/[locale]/admin/(console)/api-keys/actions';
import {CopyButton} from '@/components/admin/CopyButton';
import {API_SCOPES} from '@/lib/api/scopes';
import {cn} from '@/lib/utils/cn';

/**
 * The API-key creation form.
 *
 * After a successful creation the key is displayed once, with a copy button
 * and an explicit warning, and is then unrecoverable. The panel stays on
 * screen until dismissed so that a mis-click cannot lose it.
 */
export function ApiKeyCreator() {
  const t = useTranslations('admin');
  const router = useRouter();

  const [name, setName] = useState('');
  const [scopes, setScopes] = useState<string[]>(['posts:read']);
  const [expiresInDays, setExpiresInDays] = useState('0');
  const [issuedKey, setIssuedKey] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isCreating, startCreating] = useTransition();

  const toggleScope = (scope: string) => {
    setScopes((current) =>
      current.includes(scope)
        ? current.filter((item) => item !== scope)
        : [...current, scope],
    );
  };

  const handleCreate = () => {
    setError(null);

    startCreating(async () => {
      const result = await createApiKeyAction({
        name,
        scopes,
        expiresInDays: Number.parseInt(expiresInDays, 10) || 0,
      });

      if (!result.ok) {
        setError(result.message);
        return;
      }

      setIssuedKey(result.key);
      setName('');
      router.refresh();
    });
  };

  return (
    <div className="card space-y-4 p-5">
      {issuedKey && (
        <div className="space-y-2 rounded-xl border border-[var(--color-accent)] bg-[var(--color-accent-soft)] p-4">
          <p className="text-sm font-medium text-[var(--color-accent)]">
            ⚠ {t('apiKey.created')}
          </p>
          <div className="flex flex-wrap items-center gap-2">
            <code className="min-w-0 flex-1 truncate rounded-lg bg-[var(--color-surface)] px-3 py-2 font-mono text-xs">
              {issuedKey}
            </code>
            <CopyButton value={issuedKey} />
            <button
              type="button"
              onClick={() => setIssuedKey(null)}
              className="rounded-lg px-3 py-1 text-xs font-medium text-[var(--color-ink-muted)] hover:text-[var(--color-ink)]"
            >
              {t('cancel')}
            </button>
          </div>
        </div>
      )}

      <div className="grid gap-3 sm:grid-cols-[1fr_9rem]">
        <div className="space-y-1.5">
          <label
            htmlFor="key-name"
            className="block text-sm font-medium text-[var(--color-ink-muted)]"
          >
            {t('apiKey.name')}
          </label>
          <input
            id="key-name"
            value={name}
            placeholder="apex-predictor-bot"
            onChange={(event) => setName(event.target.value)}
            className="w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] px-3.5 py-2.5 text-sm outline-none focus:border-[var(--color-accent)]"
          />
        </div>

        <div className="space-y-1.5">
          <label
            htmlFor="key-expiry"
            className="block text-sm font-medium text-[var(--color-ink-muted)]"
          >
            {t('apiKey.expiry')}
          </label>
          <select
            id="key-expiry"
            value={expiresInDays}
            onChange={(event) => setExpiresInDays(event.target.value)}
            className="w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] px-3.5 py-2.5 text-sm outline-none focus:border-[var(--color-accent)]"
          >
            <option value="0">{t('apiKey.neverExpires')}</option>
            <option value="30">30d</option>
            <option value="90">90d</option>
            <option value="365">365d</option>
          </select>
        </div>
      </div>

      <fieldset className="space-y-2">
        <legend className="text-sm font-medium text-[var(--color-ink-muted)]">
          {t('apiKey.scopes')}
        </legend>
        <div className="flex flex-wrap gap-1.5">
          {API_SCOPES.map((scope) => (
            <button
              key={scope}
              type="button"
              aria-pressed={scopes.includes(scope)}
              onClick={() => toggleScope(scope)}
              className={cn(
                'rounded-lg px-3 py-1 font-mono text-xs transition',
                scopes.includes(scope)
                  ? 'bg-[var(--color-accent)] text-[var(--color-on-accent)]'
                  : 'bg-[var(--color-surface-sunken)] text-[var(--color-ink-muted)] hover:text-[var(--color-ink)]',
              )}
            >
              {scope}
            </button>
          ))}
        </div>
      </fieldset>

      {error && (
        <p role="alert" className="text-sm text-[var(--color-danger)]">
          {error}
        </p>
      )}

      <button
        type="button"
        onClick={handleCreate}
        disabled={isCreating || name.trim().length === 0}
        className="rounded-lg bg-[var(--color-accent)] px-5 py-2 text-sm font-semibold text-[var(--color-on-accent)] transition hover:opacity-90 disabled:opacity-60"
      >
        {isCreating ? t('saving') : t('apiKey.create')}
      </button>
    </div>
  );
}
