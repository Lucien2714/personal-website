'use client';

import {useTranslations} from 'next-intl';

import {Link, usePathname} from '@/i18n/navigation';
import {cn} from '@/lib/utils/cn';

/**
 * The console's section navigation.
 *
 * A client component solely so that it can mark the current section from
 * `usePathname`; everything it links to is rendered on the server.
 */

/** Sections, in the order they appear. */
const SECTIONS = [
  {href: '/admin', key: 'dashboard', icon: '📊', exact: true},
  {href: '/admin/posts', key: 'posts', icon: '📝', exact: false},
  {href: '/admin/moments', key: 'moments', icon: '🌙', exact: false},
  {href: '/admin/projects', key: 'projects', icon: '🛠', exact: false},
  {href: '/admin/pages', key: 'pages', icon: '📄', exact: false},
  {href: '/admin/media', key: 'media', icon: '🖼', exact: false},
  {href: '/admin/api-keys', key: 'apiKeys', icon: '🔑', exact: false},
  {href: '/admin/settings', key: 'settings', icon: '⚙', exact: false},
] as const;

/** Renders the section navigation. */
export function AdminNav() {
  const t = useTranslations('admin');
  const pathname = usePathname();

  return (
    <nav aria-label={t('title')}>
      <ul className="flex gap-1 overflow-x-auto lg:flex-col lg:overflow-visible">
        {SECTIONS.map((section) => {
          const active = section.exact
            ? pathname === section.href
            : pathname === section.href ||
              pathname.startsWith(`${section.href}/`);

          return (
            <li key={section.href} className="shrink-0">
              <Link
                href={section.href}
                aria-current={active ? 'page' : undefined}
                className={cn(
                  'flex items-center gap-2.5 rounded-xl px-3 py-2 text-sm font-medium transition',
                  active
                    ? 'bg-[var(--color-accent-soft)] text-[var(--color-accent)]'
                    : 'text-[var(--color-ink-muted)] hover:bg-[var(--color-surface-sunken)]',
                )}
              >
                <span aria-hidden="true">{section.icon}</span>
                {t(section.key)}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
