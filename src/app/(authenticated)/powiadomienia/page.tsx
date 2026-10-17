import type { Metadata } from 'next'
import { requireUser } from '@/lib/supabase/server'
import { getNotifications } from '@/lib/notifications'
import { PageContainer } from '@/app/components/page-container'
import { NotificationsView } from './notifications-view'

export const metadata: Metadata = { title: 'Powiadomienia · ZapiszPrzepis', robots: { index: false } }

// Screen 5 (E01-S15): full-screen notifications, opened from the header bell
// and the home banner. A page, not an overlay: it has a URL, survives a refresh
// and closes with the browser back button. Guests are sent to /login by middleware.
export default async function NotificationsPage() {
  const { supabase, user } = await requireUser()
  const result = await getNotifications(supabase, user.id)

  return (
    <main className="min-h-screen bg-white pb-10 text-[19px] text-ink">
      <PageContainer className="pt-2">
        <NotificationsView result={result} />
      </PageContainer>
    </main>
  )
}
