import type { ReactNode } from 'react'
import { AppShell } from '@/app/components/app-shell'

// Public category listings (E01-S09) share the app chrome with /przepis/{slug}.
export default function KategoriaLayout({ children }: { children: ReactNode }) {
  return <AppShell>{children}</AppShell>
}
