'use client'

import Image from 'next/image'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Plus } from 'lucide-react'
import { AppMenu } from './app-menu'
import { PageBackLink } from './header-back-link'
import { NotificationBell } from './notification-bell'
import { PageContainer } from './page-container'
import { HeaderNav } from './header-nav'
import { HeaderSearch } from './header-search'
import type { FailedSharesResult } from '@/lib/failed-shares'
import type { MenuSummary } from '@/lib/menu-summary'
import { ADD_RECIPE_PATH, PRZEPIS_PAGE_RE } from '@/lib/routes'

export function AppHeader({
  failedShares,
  isAuthenticated,
  menu,
}: {
  failedShares: FailedSharesResult
  /** Guest (E01-S02) vs signed-in: guests get "Zaloguj się" instead of Dodaj + the bell. */
  isAuthenticated: boolean
  /** MENU counters + full access (E01-S09); the drawer degrades without it. */
  menu?: MenuSummary | null
}) {
  const pathname = usePathname()
  // Below lg "← Wróć" replaces the logo on the screens below the start page (handoff 1c);
  // the desktop header (E01-S17) keeps the logo. Not on a recipe page: its list bar
  // („← Ciasteczka · 7 z 91”) already leads back, so the header keeps the logo
  // linking home (owner decision 2026-10-19 — one back link per screen).
  const showBack = pathname !== '/' && !PRZEPIS_PAGE_RE.test(pathname)
  // The 120x30 lettering where the right-hand buttons leave room for it (signed in:
  // 64+100+60 px of buttons), the compact icon below that, so nothing overflows at 320 px.
  const lettering = isAuthenticated ? 'min-[390px]:block' : 'min-[360px]:block'
  const compactIcon = isAuthenticated ? 'min-[390px]:hidden' : 'min-[360px]:hidden'

  return (
    <header className="sticky top-0 z-20 border-b-2 border-border-card bg-white/95 backdrop-blur lg:border-b">
      {/* Mobile 1c (E01-S19): ~64 px, padding 4/12/4/16. Desktop (E01-S17, A8/A9)
          from lg: a guest gets Przepisy + Kategorie and Zaloguj się + Załóż konto;
          a signed-in user gets the search field. */}
      <PageContainer className="flex min-h-16 items-center justify-between gap-2 py-1 pr-3 pl-4 sm:px-6 lg:min-h-0 lg:gap-6 lg:px-8 lg:py-3">
        <div className="flex min-w-0 items-center gap-2 lg:gap-6">
          {showBack && <PageBackLink crowded={isAuthenticated} className="lg:hidden" />}
          <Link
            href="/"
            aria-label="ZapiszPrzepis — strona główna"
            className={`${showBack ? 'hidden lg:flex' : 'flex'} min-h-12 shrink-0 items-center gap-2 no-underline!`}
          >
            <Image
              src="/logo-lettering.svg"
              alt=""
              width={120}
              height={30}
              unoptimized
              priority
              className={`hidden h-[30px] w-[120px] ${lettering} lg:hidden`}
            />
            <Image
              src="/logo-icon.svg"
              alt=""
              width={40}
              height={40}
              unoptimized
              priority
              className={`h-10 w-10 ${compactIcon} lg:block`}
            />
            {/* The desktop wordmark (E01-S17); below lg the lettering image is the logo. */}
            <span aria-hidden="true" className="hidden text-[1.625rem] font-bold tracking-wide lg:inline">
              <span className="text-gray-900">Zapisz</span>
              <span className="text-orange-700">Przepis</span>
            </span>
          </Link>
          {!isAuthenticated && <HeaderNav className="hidden lg:flex" />}
        </div>
        {isAuthenticated && <HeaderSearch className="hidden lg:flex" />}
        <div className="flex shrink-0 items-center gap-1 lg:ml-auto lg:gap-2">
          {isAuthenticated ? (
            <>
              {/* 1c header (E01-S10): icon over label, 64x56, #c2410c. Shown without full
                  access too: /dodaj then shows the access-code gate (3c). */}
              <Link
                href={ADD_RECIPE_PATH}
                aria-label="Dodaj przepis"
                className="inline-flex h-14 w-16 shrink-0 flex-col items-center justify-center gap-0.5 rounded-[12px] bg-action text-[13px] leading-none font-bold text-white no-underline! transition-colors hover:bg-action-hover lg:h-12 lg:w-auto lg:flex-row lg:gap-1.5 lg:whitespace-nowrap lg:rounded-field lg:px-4 lg:text-[18px]"
              >
                <Plus aria-hidden="true" className="h-6 w-6 lg:h-5 lg:w-5" />
                Dodaj<span className="-ml-1.5 hidden lg:inline">&nbsp;przepis</span>
              </Link>
              <NotificationBell failedShares={failedShares} />
            </>
          ) : (
            <>
              <Link
                href="/login"
                // Mobile 1c (E01-S19): outlined, 52 px.
                className="inline-flex min-h-[52px] items-center whitespace-nowrap rounded-field border-2 border-field px-3 text-[17px] font-bold text-ink no-underline! hover:bg-surface-2 lg:min-h-[48px] lg:px-4 lg:text-[18px] lg:font-semibold"
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
            <AppMenu isAuthenticated={isAuthenticated} summary={menu} />
          </div>
        </div>
      </PageContainer>
    </header>
  )
}
