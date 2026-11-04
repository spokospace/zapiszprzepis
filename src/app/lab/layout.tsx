import type { ReactNode } from 'react'
import { AppHeader } from '@/app/components/app-header'
import { NO_FAILED_SHARES } from '@/lib/failed-shares'

/**
 * Chrome for the temporary recipe-lab routes (#701): the guest header, built without
 * `AppShell`, which reads the session cookie and would make every route under it
 * dynamic. Nothing here may call cookies(), headers() or the Supabase server client.
 */
export default function LabLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <AppHeader failedShares={NO_FAILED_SHARES} isAuthenticated={false} />
      {children}
    </>
  )
}
