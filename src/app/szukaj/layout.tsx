import type { ReactNode } from 'react'
import { AppShell } from '@/app/components/app-shell'

// The public search results page /szukaj (E01-S05) shares the app chrome with the recipe pages.
export default function SzukajLayout({ children }: { children: ReactNode }) {
  return <AppShell>{children}</AppShell>
}
