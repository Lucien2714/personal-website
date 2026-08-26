'use client';

import Image from 'next/image';
import {useTranslations} from 'next-intl';
import {type ReactNode, useState} from 'react';

import {LocaleSwitcher} from '@/components/layout/LocaleSwitcher';
import {ThemeToggle} from '@/components/theme/ThemeToggle';
import {Link, usePathname} from '@/i18n/navigation';
import {cn} from '@/lib/utils/cn';

/** One entry in the primary navigation. */
export interface NavItem {
  /** Locale-agnostic href, for example `/posts`. */
  href: string;
  /** Already-translated label. */
  label: string;
}

/** Props accepted by {@link SiteHeader}. */
export interface SiteHeaderProps {
  siteTitle: string;
  avatarUrl: string;
  /** Extra entries contributed by editable pages, such as About. */
  extraItems: NavItem[];
  /**
   * The account area, rendered by the server layout and passed in.
   *
   * This component is a client component (it owns the mobile menu state),
   * and a client component cannot render a server one as a child - but it
   * can receive one as a prop.
   */
  accountSlot: ReactNode;
}

/**
 * The sticky site header.
 *
 * Carries the wordmark, the primary navigation, the language switcher and the
 * theme toggle, and collapses to a disclosure menu below the `md` breakpoint.
 */
export function SiteHeader({
  siteTitle,
  avatarUrl,
  extraItems,
  accountSlot,
}: SiteHeaderProps) {
  const t = useTranslations('nav');
  const pathname = usePathname();

  // The menu's open state is stored as *which route it was opened on* rather
  // than as a boolean. Navigating therefore closes it automatically, because
  // the remembered path stops matching the current one - no effect, and no
  // window in which the menu covers the page the reader just moved to.
  const [openedOn, setOpenedOn] = useState<string | null>(null);
  const menuOpen = openedOn === pathname;

  const setMenuOpen = (open: boolean) => {
    setOpenedOn(open ? pathname : null);
  };

  const items: NavItem[] = [
    {href: '/posts', label: t('posts')},
    {href: '/moments', label: t('moments')},
    {href: '/projects', label: t('projects')},
    {href: '/archives', label: t('archives')},
    ...extraItems,
  ];

  /** True when `href` is the current route or an ancestor of it. */
  const isActive = (href: string) =>
    pathname === href || pathname.startsWith(`${href}/`);

  return (
    <header
      className={cn(
        'sticky top-0 z-40 border-b',
        'border-[var(--color-border)]',
        'bg-[var(--color-canvas)]/85 backdrop-blur-md',
      )}
    >
      <div className="mx-auto flex h-16 max-w-5xl items-center gap-3 px-4">
        <Link
          href="/"
          className="group flex shrink-0 items-center gap-2.5"
          aria-label={siteTitle}
        >
          <span
            className={cn(
              'relative inline-flex h-9 w-9 overflow-hidden rounded-lg',
              'ring-2 ring-[var(--color-accent-soft)] transition',
              'group-hover:ring-[var(--color-accent)]',
            )}
          >
            <Image
              src={avatarUrl}
              alt=""
              width={36}
              height={36}
              className="h-full w-full object-cover"
              priority
            />
          </span>
          <span className="font-display text-lg font-bold tracking-tight">
            {siteTitle}
          </span>
        </Link>

        <nav
          className="ml-auto hidden items-center gap-6 md:flex"
          aria-label={t('openMenu')}
        >
          {items.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              data-active={isActive(item.href)}
              className={cn(
                'link-sweep text-sm font-medium transition',
                isActive(item.href)
                  ? 'text-[var(--color-accent)]'
                  : 'text-[var(--color-ink-muted)] hover:text-[var(--color-ink)]',
              )}
            >
              {item.label}
            </Link>
          ))}
        </nav>

        <div className="ml-auto flex items-center gap-2 md:ml-4">
          <span className="hidden sm:inline-flex">{accountSlot}</span>
          <LocaleSwitcher className="hidden sm:inline-flex" />
          <ThemeToggle />
          <button
            type="button"
            className={cn(
              'inline-flex h-9 w-9 items-center justify-center rounded-lg md:hidden',
              'border border-[var(--color-border)] bg-[var(--color-surface)]',
              'text-[var(--color-ink-muted)]',
            )}
            aria-expanded={menuOpen}
            aria-controls="mobile-nav"
            aria-label={menuOpen ? t('closeMenu') : t('openMenu')}
            onClick={() => setMenuOpen(!menuOpen)}
          >
            <span aria-hidden="true">{menuOpen ? '✕' : '☰'}</span>
          </button>
        </div>
      </div>

      {menuOpen && (
        <nav
          id="mobile-nav"
          className="border-t border-[var(--color-border)] px-4 py-3 md:hidden"
        >
          <ul className="flex flex-col gap-1">
            {items.map((item) => (
              <li key={item.href}>
                <Link
                  href={item.href}
                  className={cn(
                    'block rounded-xl px-3 py-2 text-sm font-medium transition',
                    isActive(item.href)
                      ? 'bg-[var(--color-accent-soft)] text-[var(--color-accent)]'
                      : 'text-[var(--color-ink-muted)] hover:bg-[var(--color-surface-sunken)]',
                  )}
                >
                  {item.label}
                </Link>
              </li>
            ))}
          </ul>
          <div className="mt-3 flex flex-wrap items-center gap-2 sm:hidden">
            <LocaleSwitcher />
            {accountSlot}
          </div>
        </nav>
      )}
    </header>
  );
}
