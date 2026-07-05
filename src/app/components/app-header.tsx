import Link from 'next/link'
import { signOut } from '@/app/(actions)/sign-out'
import { NotificationBell } from './notification-bell'
import type { FailedShare } from '@/lib/failed-shares'

/**
 * Slim sticky header for authenticated screens. Home for the notification bell
 * (S-06) and sign-out (previously only reachable from the landing page).
 */
export function AppHeader({ failedShares }: { failedShares: FailedShare[] }) {
  return (
    <header className="sticky top-0 z-20 border-b border-gray-200 bg-white/95 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3 sm:px-6 lg:px-8">
        <Link href="/" className="text-lg font-bold text-gray-900">
          ZapiszPrzepis
        </Link>
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
