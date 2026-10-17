import type { ReactNode } from 'react'
import { AppShell } from '@/app/components/app-shell'

// Public profiles /u/{username} (E01-S14) share the app chrome with /przepis/{slug}.
export default function ProfileLayout({ children }: { children: ReactNode }) {
  return <AppShell>{children}</AppShell>
}
