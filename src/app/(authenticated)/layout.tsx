import type { ReactNode } from 'react'
import { createSupabaseServerClient, getCurrentUser } from '@/lib/supabase/server'
import { getFailedShares, NO_FAILED_SHARES } from '@/lib/failed-shares'
import { AppHeader } from '@/app/components/app-header'

/**
 * Shared shell for the recipe screens. Renders the header (with the S-06
 * notification bell) above every recipes route. Since E01-S02 a guest can reach
 * the public recipe page through this layout, so the header switches between the
 * guest and logged-in variants and a guest gets no bell (no shares to query).
 * Auth redirects for owner-only routes stay in those pages.
 */
export default async function AuthenticatedLayout({ children }: { children: ReactNode }) {
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
