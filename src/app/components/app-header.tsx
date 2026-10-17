'use client'

import Image from 'next/image'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { ChevronLeft, Plus } from 'lucide-react'
import { AppMenu } from './app-menu'
import { NotificationBell } from './notification-bell'
import { PageContainer } from './page-container'
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
      <PageContainer className="flex items-center justify-between py-3">
        <div className="flex items-center gap-2">
          {showBackToList && (
            <Link
              href="/recipes"
              aria-label="Wróć do listy przepisów"
              className="text-gray-500 hover:text-gray-900 transition-colors"
            >
              <ChevronLeft className="h-5 w-5" />
            </Link>
          )}
          <Link href="/">
            <Image
              src="/logo-lettering.svg"
              alt="ZapiszPrzepis"
              width={120}
              height={30}
              unoptimized
              priority
            />
          </Link>
        </div>
        <div className="flex items-center gap-1">
          {isAuthenticated ? (
            <>
              {/* 1c header (E01-S10): icon over label, 64x56, #c2410c. Shown without full
                  access too: /dodaj then shows the access-code gate (3c). */}
              <Link
                href={ADD_RECIPE_PATH}
                aria-label="Dodaj przepis"
                className="mr-1 inline-flex h-14 w-16 shrink-0 flex-col items-center justify-center gap-0.5 rounded-[12px] bg-action text-[13px] leading-none font-bold text-white no-underline transition-colors hover:bg-action-hover"
              >
                <Plus aria-hidden="true" className="h-6 w-6" />
                Dodaj
              </Link>
              <NotificationBell failedShares={failedShares} />
            </>
          ) : (
            <Link
              href="/login"
              className="mr-1 inline-flex min-h-[44px] items-center rounded-lg border-2 border-gray-500 px-3 text-sm font-semibold text-gray-900 hover:bg-gray-50"
            >
              Zaloguj się
            </Link>
          )}
          <AppMenu isAuthenticated={isAuthenticated} summary={menu} />
        </div>
      </PageContainer>
    </header>
  )
}
