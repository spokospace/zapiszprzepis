import type { ReactNode } from 'react'
import { AppShell } from '@/app/components/app-shell'

// The public recipe page (/przepis/{slug}, E01-S03b) sits outside the
// (authenticated) group but reuses its chrome so a shared link looks unchanged.
export default function PrzepisLayout({ children }: { children: ReactNode }) {
  return <AppShell>{children}</AppShell>
}
