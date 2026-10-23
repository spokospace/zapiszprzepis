import type { Metadata } from 'next'
import { PageContainer } from '@/app/components/page-container'
import { TextSizePreferences } from './text-size-preferences'

export const metadata: Metadata = { title: 'Wielkość tekstu · Zapisz Przepis' }

/**
 * Display preferences (FR #485): the one home for the „Wielkość tekstu" (A / A+ / A++)
 * control, reachable by everyone from the MENU drawer — no login (the accessibility
 * affordance a first-time older visitor needs must not sit behind the sign-in screen;
 * DISPLAY_PREFS_PATH is in isPublicRoute). No server data: the shared header via AppShell
 * (this route's layout) and one client island. The saved level is per-device
 * (localStorage) and applied app-wide by TextScaleApplier in the root layout.
 */
export default function WyswietlaniePage() {
  return (
    <main className="min-h-screen bg-white">
      <PageContainer narrow className="py-6 sm:py-12">
        <h1 className="mb-6 text-[30px] leading-tight font-bold text-ink">Wielkość tekstu</h1>
        <TextSizePreferences />
      </PageContainer>
    </main>
  )
}
