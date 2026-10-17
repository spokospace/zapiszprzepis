import type { ReactNode } from 'react'
import { AppShell } from '@/app/components/app-shell'

// The owner's recipe screens; AppShell renders the shared header (+ S-06 bell).
export default function AuthenticatedLayout({ children }: { children: ReactNode }) {
  return <AppShell>{children}</AppShell>
}
