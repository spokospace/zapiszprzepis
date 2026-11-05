import type { Metadata } from 'next'
import { requireUser } from '@/lib/supabase/server'
import { getNotifications } from '@/lib/notifications'
import { PageContainer } from '@/app/components/page-container'
import { SessionRefresh } from '@/app/components/session-header'
import { NotificationsView } from './notifications-view'

export const metadata: Metadata = { title: 'Powiadomienia · Zapisz Przepis', robots: { index: false } }

// Screen 5 (E01-S15): full-screen notifications, opened from the header bell
// and the home banner. A page, not an overlay: it has a URL, survives a refresh
// and closes with the browser back button. Guests are sent to /login by middleware.
export default async function NotificationsPage() {
  const { supabase, user } = await requireUser()
  const result = await getNotifications(supabase, user.id)

  return (
    <main className="min-h-screen bg-white pb-10 text-[19px] text-ink">
      {/* The actions here re-render the page; the MENU badge lives in the browser. */}
      <SessionRefresh token={result} />
      <PageContainer className="pt-2">
        <NotificationsView result={result} />
      </PageContainer>
    </main>
  )
}
