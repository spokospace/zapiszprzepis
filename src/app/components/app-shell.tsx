import type { ReactNode } from 'react'
import { SessionHeader } from '@/app/components/session-header'

/**
 * The app chrome shared by the recipe screens (the `(authenticated)` group) and the
 * public pages, which must look identical. It reads no session: the header gets the
 * guest or signed-in variant in the browser, and auth redirects for owner-only routes
 * stay in those pages.
 */
export function AppShell({ children }: { children: ReactNode }) {
  return (
    <>
      <SessionHeader />
      {children}
    </>
  )
}
