'use client'

import { useEffect, useSyncExternalStore } from 'react'
import { usePathname } from 'next/navigation'
import { AppHeader } from './app-header'
import { browserSession } from '@/lib/browser-session'
import { NO_FAILED_SHARES } from '@/lib/failed-shares'

/**
 * The app header fed from the browser, so a layout reads no session and the page can be
 * the same for everyone. Re-reads the session on every page and on return to the tab:
 * signing in or out happens on the server.
 */
export function SessionHeader() {
  const session = useSyncExternalStore(browserSession.subscribe, browserSession.getSnapshot, browserSession.getServerSnapshot)
  const pathname = usePathname()

  useEffect(() => {
    void browserSession.sync()
  }, [pathname])

  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState === 'visible') void browserSession.sync()
    }
    document.addEventListener('visibilitychange', onVisible)
    return () => document.removeEventListener('visibilitychange', onVisible)
  }, [])

  const user = session.status === 'user' ? session : null
  return (
    <AppHeader
      sessionKnown={session.status !== 'unknown'}
      isAuthenticated={user !== null}
      failedShares={user?.failedShares ?? NO_FAILED_SHARES}
      menu={user?.menu}
    />
  )
}

/** Reloads the header's counters whenever `token` changes, e.g. after a Server Action re-rendered the page. */
export function SessionRefresh({ token }: { token: unknown }) {
  useEffect(() => {
    void browserSession.sync({ force: true })
  }, [token])
  return null
}
