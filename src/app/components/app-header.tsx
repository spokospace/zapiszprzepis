'use client'

import Image from 'next/image'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { ChevronLeft, Plus } from 'lucide-react'
import { AppMenu } from './app-menu'
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
  // Shown on the canonical recipe page (/przepis/{slug}, E01-S03b); the back link
  // targets "/recipes" (Moje przepisy), which is owner-only.
  const showBackToList = isAuthenticated && PRZEPIS_PAGE_RE.test(pathname)

  return (
    <header className="sticky top-0 z-20 border-b border-gray-200 bg-white/95 backdrop-blur">
      {/* Desktop (E01-S17, A8/A9) from lg: a guest gets Przepisy + Kategorie and
          Zaloguj się + Załóż konto; a signed-in user gets the search field. */}
      <PageContainer className="flex items-center justify-between py-3 lg:gap-6">
        <div className="flex items-center gap-2 lg:gap-6">
          {showBackToList && (
            <Link
              href="/recipes"
              aria-label="Wróć do listy przepisów"
              className="text-gray-500 hover:text-gray-900 transition-colors"
            >
              <ChevronLeft className="h-5 w-5" />
            </Link>
          )}
          <Link href="/" aria-label="ZapiszPrzepis — strona główna" className="flex items-center gap-2 no-underline! lg:shrink-0">
            <Image
              src="/logo-icon.svg"
              alt=""
              width={32}
              height={32}
              unoptimized
              priority
              className="h-8 w-8 sm:h-10 sm:w-10"
            />
            {/* Wordmark only from tablet up; on phones the icon alone is the logo. */}
            <span aria-hidden="true" className="hidden text-[1.625rem] font-bold tracking-wide sm:inline">
              <span className="text-gray-900">Zapisz</span>
              <span className="text-orange-700">Przepis</span>
            </span>
          </Link>
          {!isAuthenticated && <HeaderNav className="hidden lg:flex" />}
        </div>
        {isAuthenticated && <HeaderSearch className="hidden lg:flex" />}
        <div className="flex items-center gap-1 lg:ml-auto lg:gap-2">
          {isAuthenticated ? (
            <>
              {/* 1c header (E01-S10): icon over label, 64x56, #c2410c. Shown without full
                  access too: /dodaj then shows the access-code gate (3c). */}
              <Link
                href={ADD_RECIPE_PATH}
                aria-label="Dodaj przepis"
                className="mr-1 inline-flex h-14 w-16 shrink-0 flex-col items-center justify-center gap-0.5 rounded-[12px] bg-action text-[13px] leading-none font-bold text-white no-underline! transition-colors hover:bg-action-hover lg:mr-0 lg:h-12 lg:w-auto lg:flex-row lg:gap-1.5 lg:whitespace-nowrap lg:rounded-field lg:px-4 lg:text-[18px]"
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
                className="mr-1 inline-flex min-h-[44px] items-center whitespace-nowrap rounded-lg border-2 border-gray-500 px-3 text-sm font-semibold text-gray-900 hover:bg-gray-50 lg:mr-0 lg:min-h-[48px] lg:rounded-field lg:border-field lg:px-4 lg:text-[18px]"
              >
                Zaloguj się
              </Link>
              {/* One OAuth screen both signs in and creates the account. */}
              <Link
                href="/login"
                className="hidden min-h-[48px] items-center whitespace-nowrap rounded-field bg-action px-4 text-[18px] font-bold text-white hover:bg-action-hover lg:inline-flex"
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
