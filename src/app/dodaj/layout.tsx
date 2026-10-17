import type { ReactNode } from 'react'
import { AppShell } from '@/app/components/app-shell'

// The add page /dodaj (E01-S10) shares the app chrome with the other screens.
export default function DodajLayout({ children }: { children: ReactNode }) {
  return <AppShell>{children}</AppShell>
}
