'use client'

import Image from 'next/image'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { ChevronLeft } from 'lucide-react'
import { signOut } from '@/app/(actions)/sign-out'
import { NotificationBell } from './notification-bell'
import type { FailedShare } from '@/lib/failed-shares'

const RECIPE_DETAIL_RE = /^\/recipes\/[^/]+$/

export function AppHeader({ failedShares }: { failedShares: FailedShare[] }) {
  const pathname = usePathname()
  const isRecipeDetail = RECIPE_DETAIL_RE.test(pathname)

  return (
    <header className="sticky top-0 z-20 border-b border-gray-200 bg-white/95 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3 sm:px-6 lg:px-8">
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
              src="/logo.svg"
              alt="ZapiszPrzepis"
              width={120}
              height={41}
              unoptimized
              priority
            />
          </Link>
        </div>
        <div className="flex items-center gap-1">
          <NotificationBell failedShares={failedShares} />
          <form action={signOut}>
            <button
              type="submit"
              className="rounded-lg px-3 py-1.5 text-sm font-medium text-gray-600 hover:bg-gray-100"
            >
              Wyloguj
            </button>
          </form>
        </div>
      </div>
    </header>
  )
}
