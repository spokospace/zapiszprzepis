import type { ReactNode } from 'react'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { getFailedShares } from '@/lib/failed-shares'
import { AppHeader } from '@/app/components/app-header'

/**
 * Shared shell for authenticated screens. Renders the header (with the S-06
 * notification bell) above every recipes route. Auth redirects stay in the
 * pages; RLS returns no shares for an unauthenticated request, so the bell is
 * simply empty in that (transient) case.
 */
export default async function AuthenticatedLayout({ children }: { children: ReactNode }) {
  const supabase = await createSupabaseServerClient()
  const failedShares = await getFailedShares(supabase)

  return (
    <>
      <AppHeader failedShares={failedShares} />
      {children}
    </>
  )
}
