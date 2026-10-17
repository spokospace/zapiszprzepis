import type { ReactNode } from 'react'
import { createSupabaseServerClient, getCurrentUser } from '@/lib/supabase/server'
import { getFailedShares, NO_FAILED_SHARES } from '@/lib/failed-shares'
import { AppHeader } from '@/app/components/app-header'

/**
 * The app chrome — the header with the S-06 notification bell — shared by the
 * recipe screens (the `(authenticated)` group) and the public recipe page at
 * `/przepis/{slug}` (E01-S03b), which sits outside that group but must look
 * identical. The header switches between the guest and logged-in variants; a
 * guest gets no bell (no shares to query). Auth redirects for owner-only routes
 * stay in those pages.
 */
export async function AppShell({ children }: { children: ReactNode }) {
  const supabase = await createSupabaseServerClient()
  const user = await getCurrentUser()
  const failedShares = user ? await getFailedShares(supabase, user.id) : NO_FAILED_SHARES

  return (
    <>
      <AppHeader failedShares={failedShares} isAuthenticated={Boolean(user)} />
      {children}
    </>
  )
}
