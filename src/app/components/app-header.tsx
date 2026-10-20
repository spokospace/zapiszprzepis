'use client'

import { Suspense, use } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Plus, Search } from 'lucide-react'
import { AppMenu } from './app-menu'
import { LogoIcon, LogoWordmark } from './brand-logo'
import { PageBackLink } from './header-back-link'
import { useHeaderBackTarget } from './header-back-target'
import { PageContainer } from './page-container'
import { HeaderNav } from './header-nav'
import { HeaderSearch } from './header-search'
import type { FailedSharesResult } from '@/lib/failed-shares'
import type { MenuSummary } from '@/lib/menu-summary'
import { notificationBadge } from '@/lib/notification-badge'
import { ADD_RECIPE_PATH, PRZEPIS_PAGE_RE, SEARCH_PATH } from '@/lib/routes'

/** A value, or the promise of one a server component passed down without awaiting it (#226). */
type Awaitable<T> = T | PromiseLike<T>

function isThenable<T>(value: Awaitable<T>): value is PromiseLike<T> {
  return typeof (value as PromiseLike<T> | null)?.then === 'function'
}

/** Suspends on a pending promise (inside the caller's Suspense boundary); a plain value passes through. */
function useAwaited<T>(value: Awaitable<T>): T {
  return isThenable(value) ? use(value as Promise<T>) : value
}

/** The signed-in desktop nav: "Moje przepisy" needs the full-access flag, which arrives with the menu summary. */
function HeaderMemberNav({ menu }: { menu: Awaitable<MenuSummary | null | undefined> }) {
  const summary = useAwaited(menu)
  return <HeaderNav className="hidden lg:flex" member={{ hasFullAccess: summary?.hasFullAccess ?? false }} />
}

function HeaderMenu({
  isAuthenticated,
  failedShares,
  menu,
}: {
  isAuthenticated: boolean
  failedShares: Awaitable<FailedSharesResult>
  menu: Awaitable<MenuSummary | null | undefined>
}) {
  const summary = useAwaited(menu)
  const shares = useAwaited(failedShares)
  return (
    <AppMenu
      isAuthenticated={isAuthenticated}
      summary={summary}
      notifications={isAuthenticated ? notificationBadge(shares) : null}
    />
  )
}

export function AppHeader({
  failedShares,
  isAuthenticated,
  menu,
}: {
  /**
   * The notifications check. A layout passes the promise unawaited, so the header
   * and the page (its loading skeleton included) are sent at once and the bell and
   * MENU badge fill in when it returns (#226).
   */
  failedShares: Awaitable<FailedSharesResult>
  /** Guest (E01-S02) vs signed-in: a guest gets no Dodaj or bell; "Zaloguj się" is in MENU below lg. */
  isAuthenticated: boolean
  /** MENU counters + full access (E01-S09); the drawer degrades without it, and while it loads. */
  menu?: Awaitable<MenuSummary | null | undefined>
}) {
  const pathname = usePathname()
  // Below lg "← Wróć" replaces the logo on the screens below the start page (handoff 1c);
  // the desktop header (E01-S17) keeps the logo. On a recipe page opened from a list it
  // names the list, „← Wyniki” (C3, E01-S28 — supersedes the list bar below lg, #324).
  const showBack = pathname !== '/'
  const backTarget = useHeaderBackTarget()
  const onRecipe = PRZEPIS_PAGE_RE.test(pathname)

  return (
    // Below lg /szukaj is a full screen with its own „✕ Zamknij” bar (E01-S26).
    <header
      className={`sticky top-0 z-20 border-b-2 border-border-card bg-white/95 backdrop-blur lg:border-b ${pathname === SEARCH_PATH ? 'max-lg:hidden' : ''}`}
    >
      {/* Mobile 1c (E01-S19): ~64 px, padding 4/12/4/16. Desktop (E01-S17, A8/A9)
          from lg: a guest gets Przepisy + Kategorie and Zaloguj się + Załóż konto;
          a signed-in user gets the search field. */}
      <PageContainer className="flex min-h-16 items-center justify-between gap-2 py-1 pr-3 pl-4 sm:px-6 lg:min-h-0 lg:gap-6 lg:px-8 lg:py-3">
        <div className="flex min-w-0 items-center gap-2 lg:gap-6">
          {showBack && <PageBackLink className="lg:hidden" target={onRecipe ? backTarget : null} />}
          <Link
            href="/"
            aria-label="Zapisz Przepis — strona główna"
            className={`${showBack ? 'hidden lg:flex' : 'flex'} min-h-12 min-w-0 items-center gap-2 no-underline!`}
          >
            {/* Below lg the text alone, „Zapisz Przepis” 24 px (handoff v8, E01-S25); from
                lg the recipe icon + text (#276). The old logo-lettering.svg must not come
                back here (#320). 20 px under 360 px, so the text + Szukaj + MENU fit at
                320 px without horizontal scroll. */}
            <LogoIcon className="hidden h-10 w-10 lg:block" />
            <LogoWordmark className="text-[20px] min-[360px]:text-[24px] lg:text-[1.625rem]" />
          </Link>
          {isAuthenticated ? (
            <Suspense fallback={<HeaderNav className="hidden lg:flex" member={{ hasFullAccess: false }} />}>
              <HeaderMemberNav menu={menu} />
            </Suspense>
          ) : (
            <HeaderNav className="hidden lg:flex" />
          )}
        </div>
        {/* The start page's hero already has the one search field (E01-S31 §5), so the
            header has none there; every other page keeps it. */}
        {isAuthenticated && pathname !== '/' && <HeaderSearch className="hidden lg:flex" />}
        <div className="flex shrink-0 items-center gap-1 lg:ml-auto lg:gap-2">
          {/* Below lg, for everyone: „Szukaj” opens the full-screen search (handoff v8,
              E01-S25); icon over label like MENU. Not on /szukaj itself, which has the
              field; from lg the header has the search field or „Przepisy” instead. */}
          {pathname !== SEARCH_PATH && (
            <Link
              href={SEARCH_PATH}
              className="inline-flex h-14 w-16 shrink-0 flex-col items-center justify-center gap-0.5 rounded-field text-[13px] leading-none font-bold text-ink no-underline! hover:bg-surface-3 lg:hidden"
            >
              <Search aria-hidden="true" className="h-6 w-6" />
              Szukaj
            </Link>
          )}
          {isAuthenticated ? (
            <>
              {/* Desktop only (A9): below lg „Dodaj przepis” is in MENU („Moje”, with a lock
                  without full access) and a home-page tile (handoff v8, E01-S25). Shown
                  without full access too: /dodaj then shows the access-code gate (3c). */}
              <Link
                href={ADD_RECIPE_PATH}
                className="hidden h-12 shrink-0 flex-row items-center gap-1.5 whitespace-nowrap rounded-field bg-action px-4 text-[18px] leading-none font-bold text-white no-underline! transition-colors hover:bg-action-hover lg:inline-flex"
              >
                <Plus aria-hidden="true" className="h-5 w-5" />
                Dodaj przepis
              </Link>
              {/* „Powiadomienia” has no standalone header affordance (E01-S15b): at
                  every width the MENU button carries a small dot, the drawer a
                  „Powiadomienia” row, and Settings hosts the entry. */}
            </>
          ) : (
            <>
              <Link
                href="/login"
                // Desktop only: below lg a guest signs in from MENU, which opens with
                // „Zaloguj się” / „Załóż konto” (owner decision 2026-10-19).
                className="hidden min-h-[48px] items-center whitespace-nowrap rounded-field border-2 border-field px-4 text-[18px] font-semibold text-ink no-underline! hover:bg-surface-2 lg:inline-flex"
              >
                Zaloguj się
              </Link>
              {/* One OAuth screen both signs in and creates the account. */}
              <Link
                href="/login"
                className="hidden min-h-[48px] items-center whitespace-nowrap rounded-field bg-action px-4 text-[18px] font-bold text-white no-underline! hover:bg-action-hover lg:inline-flex"
              >
                Załóż konto
              </Link>
            </>
          )}
          {/* The guest drawer holds only the sign-in CTA and the categories, which the
              desktop header already shows. */}
          <div className={isAuthenticated ? 'flex' : 'flex lg:hidden'}>
            {/* While the counts load, a working MENU without counters or badge. */}
            <Suspense fallback={<AppMenu isAuthenticated={isAuthenticated} />}>
              <HeaderMenu isAuthenticated={isAuthenticated} failedShares={failedShares} menu={menu} />
            </Suspense>
          </div>
        </div>
      </PageContainer>
    </header>
  )
}
