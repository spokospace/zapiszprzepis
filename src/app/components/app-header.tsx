'use client'

import Image from 'next/image'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { ChevronLeft, Link as LinkIcon } from 'lucide-react'
import { AppMenu } from './app-menu'
import { NotificationBell } from './notification-bell'
import { PageContainer } from './page-container'
import type { FailedSharesResult } from '@/lib/failed-shares'

const RECIPE_DETAIL_RE = /^\/recipes\/[^/]+$/

export function AppHeader({ failedShares }: { failedShares: FailedSharesResult }) {
  const pathname = usePathname()
  const isRecipeDetail = RECIPE_DETAIL_RE.test(pathname)

  return (
    <header className="sticky top-0 z-20 border-b border-gray-200 bg-white/95 backdrop-blur">
      <PageContainer className="flex items-center justify-between py-3">
        <div className="flex items-center gap-2">
          {isRecipeDetail && (
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
          <Link
            href="/?tab=add"
            aria-label="Dodaj przepis z linku"
            className="mr-1 inline-flex items-center gap-1.5 rounded-lg bg-orange-500 px-3 py-1.5 text-sm font-medium text-white hover:bg-orange-600 transition-colors"
          >
            <LinkIcon aria-hidden="true" className="h-4 w-4" />
            Dodaj
          </Link>
          <NotificationBell failedShares={failedShares} />
          <AppMenu />
        </div>
      </PageContainer>
    </header>
  )
}
