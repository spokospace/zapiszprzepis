'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Bell } from 'lucide-react'
import type { FailedSharesResult } from '@/lib/failed-shares'
import { notificationBadge } from '@/lib/notification-badge'
import { NOTIFICATIONS_PATH } from '@/lib/routes'

/**
 * Header "Powiadomienia" (S-06, rebuilt in E01-S15): bell icon over a 13 px
 * caption, min 100 px wide, linking to the full-screen /powiadomienia page
 * instead of a 320 px dropdown. Desktop header only: below lg it lives in the
 * MENU drawer (#323). The badge counts problems + ready recipes not opened
 * yet; the number is part of the link's name, so the badge itself is
 * decorative.
 *
 * When the failed shares could not be loaded, the bell says so instead of
 * claiming there is nothing to show (#137).
 */
export function NotificationBell({ failedShares: result }: { failedShares: FailedSharesResult }) {
  const pathname = usePathname()
  const { count, loadFailed } = notificationBadge(result)

  return (
    <Link
      href={NOTIFICATIONS_PATH}
      aria-label={
        loadFailed
          ? 'Powiadomienia (nie udało się sprawdzić)'
          : count > 0
            ? `Powiadomienia (${count})`
            : 'Powiadomienia'
      }
      aria-current={pathname === NOTIFICATIONS_PATH ? 'page' : undefined}
      className="relative inline-flex h-14 min-w-[100px] flex-col items-center justify-center gap-0.5 rounded-field px-1 text-[13px] font-bold text-ink no-underline! hover:bg-surface-3"
    >
      <Bell aria-hidden="true" className="h-6 w-6" />
      Powiadomienia
      {count > 0 && (
        <span
          aria-hidden="true"
          className="absolute top-0 right-[26px] flex h-[22px] min-w-[22px] items-center justify-center rounded-pill border-2 border-white bg-danger px-1 text-[13px] leading-none font-bold text-white"
        >
          {count}
        </span>
      )}
      {loadFailed && (
        <span aria-hidden="true" className="absolute top-1 right-[30px] h-3 w-3 rounded-pill border-2 border-white bg-ink" />
      )}
    </Link>
  )
}
