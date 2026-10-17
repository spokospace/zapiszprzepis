import type { ReactNode } from 'react'
import { AppShell } from '@/app/components/app-shell'

// The public legal pages (regulamin, polityka prywatności, usuwanie danych) share the app chrome.
export default function LegalLayout({ children }: { children: ReactNode }) {
  return <AppShell>{children}</AppShell>
}
