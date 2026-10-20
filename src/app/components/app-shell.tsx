import type { ReactNode } from 'react'
import { createSupabaseServerClient, getCurrentUser } from '@/lib/supabase/server'
import { getFailedShares, NO_FAILED_SHARES, type FailedSharesResult } from '@/lib/failed-shares'
import { getMenuSummary } from '@/lib/menu-summary'
import { AppHeader } from '@/app/components/app-header'

const FAILED_SHARES_ERROR: FailedSharesResult = { status: 'error' }

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
  // Not awaited (#226): the header and the page — its loading skeleton included —
  // are sent at once; the bell, MENU badge and counters fill in when these return.
  // A failure degrades to the bell's „nie udało się sprawdzić” and a MENU without
  // counters, never to an error page.
  const failedShares = user
    ? getFailedShares(supabase, user.id).catch(() => FAILED_SHARES_ERROR)
    : NO_FAILED_SHARES
  const menu = getMenuSummary(supabase, user).catch(() => undefined)

  return (
    <>
      <AppHeader failedShares={failedShares} isAuthenticated={Boolean(user)} menu={menu} />
      {children}
    </>
  )
}
