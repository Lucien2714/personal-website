import {getTranslations, setRequestLocale} from 'next-intl/server';

import {revokeApiKeyAction} from '@/app/[locale]/admin/(console)/api-keys/actions';
import {ApiKeyCreator} from '@/components/admin/ApiKeyCreator';
import {DeleteButton} from '@/components/admin/DeleteButton';
import {FormattedDate} from '@/components/ui/FormattedDate';
import {Chip} from '@/components/ui/primitives';
import type {AppLocale} from '@/i18n/routing';
import {toScopes} from '@/lib/api/keys';
import {requireStaffForAction} from '@/lib/auth/guard';
import {db} from '@/lib/db';
import {env} from '@/lib/env';

/**
 * The API-key screen.
 *
 * This is the control surface for the "open interface" side of the site: keys
 * created here are what let your other projects read from and write to it.
 */

export const dynamic = 'force-dynamic';

/** Renders the creation form and the list of existing keys. */
export default async function AdminApiKeysPage({
  params,
}: {
  params: Promise<{locale: AppLocale}>;
}) {
  const {locale} = await params;
  setRequestLocale(locale);

  const user = await requireStaffForAction();

  const [t, keys] = await Promise.all([
    getTranslations('admin'),
    db.apiKey.findMany({
      where: {ownerId: user.id},
      orderBy: {createdAt: 'desc'},
      select: {
        id: true,
        name: true,
        prefix: true,
        scopes: true,
        lastUsedAt: true,
        expiresAt: true,
        revokedAt: true,
        createdAt: true,
      },
    }),
  ]);

  return (
    <div className="space-y-5">
      <div>
        <h2 className="font-display text-xl font-bold">{t('apiKeys')}</h2>
        <p className="mt-1 text-sm text-[var(--color-ink-muted)]">
          <code className="rounded bg-[var(--color-surface-sunken)] px-1.5 py-0.5 font-mono text-xs">
            {env.NEXT_PUBLIC_SITE_URL}/api/v1
          </code>
        </p>
      </div>

      <ApiKeyCreator />

      {keys.length === 0 ? (
        <p className="card p-8 text-center text-sm text-[var(--color-ink-muted)]">
          {t('empty')}
        </p>
      ) : (
        <ul className="card divide-y divide-[var(--color-border)]">
          {keys.map((key) => {
            const revoked = key.revokedAt !== null;
            const expired =
              key.expiresAt !== null && key.expiresAt <= new Date();

            return (
              <li
                key={key.id}
                className="flex flex-wrap items-center gap-x-3 gap-y-2 p-4"
              >
                <div className="min-w-0 flex-1">
                  <p className="flex flex-wrap items-center gap-2 text-sm font-medium">
                    {key.name}
                    <code className="font-mono text-xs text-[var(--color-ink-subtle)]">
                      {key.prefix}…
                    </code>
                    {revoked && (
                      <Chip tone="neutral">{t('apiKey.revoked')}</Chip>
                    )}
                    {!revoked && expired && (
                      <Chip tone="neutral">{t('apiKey.expired')}</Chip>
                    )}
                  </p>

                  <p className="mt-1 flex flex-wrap gap-1">
                    {toScopes(key.scopes).map((scope) => (
                      <span
                        key={scope}
                        className="rounded bg-[var(--color-surface-sunken)] px-1.5 py-0.5 font-mono text-[0.65rem] text-[var(--color-ink-subtle)]"
                      >
                        {scope}
                      </span>
                    ))}
                  </p>

                  <p className="mt-1 text-xs text-[var(--color-ink-subtle)]">
                    {key.lastUsedAt ? (
                      <>
                        {t('apiKey.lastUsedLabel')}{' '}
                        <FormattedDate value={key.lastUsedAt} variant="short" />
                      </>
                    ) : (
                      t('apiKey.neverUsed')
                    )}
                  </p>
                </div>

                {!revoked && (
                  <DeleteButton
                    id={key.id}
                    action={revokeApiKeyAction}
                    label={t('apiKey.revoke')}
                  />
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
