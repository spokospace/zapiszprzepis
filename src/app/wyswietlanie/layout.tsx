import type { ReactNode } from 'react'
import { AppShell } from '@/app/components/app-shell'

// Display preferences /wyswietlanie — a public page (E01; FR #485) sharing the app chrome.
export default function WyswietlanieLayout({ children }: { children: ReactNode }) {
  return <AppShell>{children}</AppShell>
}
