'use client'

import { Suspense, use } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Plus, Search } from 'lucide-react'
import { AppMenu } from './app-menu'
import { LogoWordmark } from './brand-logo'
import { PageBackLink } from './header-back-link'
import { useHeaderBackTarget } from './header-back-target'
import { PageContainer } from './page-container'
import { HeaderNav } from './header-nav'
import { HeaderSearch } from './header-search'
import { CategoryBar } from './category-bar'
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
  /** Guest (E01-S02) vs signed-in: a guest gets no Dodaj or Ulubione; "Zaloguj się" is in MENU below lg. */
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
      className={`sticky top-0 z-20 bg-white/95 backdrop-blur ${pathname === SEARCH_PATH ? 'max-lg:hidden' : ''}`}
    >
      {/* Row 1: a 2 px grey rule below lg (mobile 1c, E01-S19); a 1 px black rule from lg
          (ZMIANY_prototyp §2). Desktop (A8/A9) from lg: a guest gets „Zaloguj się”; a
          signed-in user gets „Ulubione”, the search field and „Dodaj przepis”. */}
      <div className="border-b-2 border-border-card lg:border-b lg:border-ink">
        <PageContainer className="flex min-h-16 items-center justify-between gap-2 py-1 pr-3 pl-4 sm:px-6 lg:min-h-0 lg:gap-6 lg:px-8 lg:py-3">
          <div className="flex min-w-0 items-center gap-2 lg:gap-6">
            {showBack && <PageBackLink className="lg:hidden" target={onRecipe ? backTarget : null} />}
            <Link
              href="/"
              aria-label="Zapisz Przepis — strona główna"
              className={`${showBack ? 'hidden lg:flex' : 'flex'} min-h-12 min-w-0 items-center gap-2 no-underline!`}
            >
              {/* „Zapisz Przepis” as text alone at every width — no icon, on desktop too
                  (ZMIANY_prototyp §2; owner decision 2026-10-20). 20 px under 360 px so the
                  text + Szukaj + MENU fit at 320 px; 24 px from there up. */}
              <LogoWordmark className="text-[20px] min-[360px]:text-[24px]" />
            </Link>
            {isAuthenticated && <HeaderNav className="hidden lg:flex" member />}
          </div>
          {/* The start page's hero already has the one search field (E01-S31 §5), so the
              header has none there; every other page keeps it. */}
          {isAuthenticated && pathname !== '/' && <HeaderSearch className="hidden lg:flex" />}
          <div className="flex shrink-0 items-center gap-1 lg:ml-auto lg:gap-2">
            {/* Below lg, for everyone: „Szukaj” opens the full-screen search (handoff v8,
                E01-S25); icon over label like MENU. Not on /szukaj itself, which has the
                field; from lg the header has the search field or the category bar instead. */}
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
              // Desktop only (A9): below lg „Dodaj przepis” is in MENU and a home-page tile.
              // An outline, not a fill — the only filled CTA is „Szukaj” in the hero
              // (ZMIANY_prototyp §2). Shown without full access too: /dodaj then gates (3c).
              <Link
                href={ADD_RECIPE_PATH}
                className="hidden h-12 shrink-0 flex-row items-center gap-1.5 whitespace-nowrap rounded-field border-2 border-action px-4 text-[18px] leading-none font-bold text-action-text no-underline! transition-colors hover:bg-surface-accent lg:inline-flex"
              >
                <Plus aria-hidden="true" className="h-5 w-5" />
                Dodaj przepis
              </Link>
            ) : (
              // Desktop only: below lg a guest signs in from MENU. One OAuth screen both
              // signs in and creates the account, so a single outlined button (§2).
              <Link
                href="/login"
                className="hidden h-12 items-center whitespace-nowrap rounded-field border-2 border-action px-4 text-[18px] font-bold text-action-text no-underline! hover:bg-surface-accent lg:inline-flex"
              >
                Zaloguj się
              </Link>
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
      </div>
      {/* Row 2: the category bar (ZMIANY_prototyp §2), desktop only — a 1 px black rule
          under it; below lg the categories are in MENU and the home tiles. */}
      <div className="hidden border-b border-ink lg:block">
        <PageContainer>
          <CategoryBar />
        </PageContainer>
      </div>
    </header>
  )
}
