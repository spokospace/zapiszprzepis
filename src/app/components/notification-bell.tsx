'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Bell } from 'lucide-react'
import type { FailedSharesResult } from '@/lib/failed-shares'
import { NOTIFICATIONS_PATH } from '@/lib/routes'

/**
 * Header notification bell (S-06). Since E01-S15 it is a link to the
 * full-screen /powiadomienia page instead of a 320 px dropdown; the retry and
 * dismiss actions live there. The badge counts what needs the user ("Wymaga
 * uwagi"), and the number is part of the link's name, so the badge itself is
 * decorative.
 *
 * When the failed shares could not be loaded, the bell says so instead of
 * claiming there is nothing to show (#137).
 */
export function NotificationBell({ failedShares: result }: { failedShares: FailedSharesResult }) {
  const pathname = usePathname()
  const loadFailed = result.status === 'error'
  const count = result.status === 'ok' ? result.shares.length : 0

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
      className="relative inline-flex h-12 w-12 items-center justify-center rounded-field text-ink-soft no-underline! hover:bg-surface-3"
    >
      <Bell aria-hidden="true" className="h-6 w-6" />
      {count > 0 && (
        <span
          aria-hidden="true"
          className="absolute right-1 top-1 flex h-5 min-w-5 items-center justify-center rounded-pill bg-danger px-1 text-[12px] font-bold leading-none text-white"
        >
          {count}
        </span>
      )}
      {loadFailed && <span className="absolute right-2 top-2 h-2.5 w-2.5 rounded-pill bg-amber-500" aria-hidden="true" />}
    </Link>
  )
}
