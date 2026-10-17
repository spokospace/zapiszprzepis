import type { ReactNode } from 'react'
import { AppShell } from '@/app/components/app-shell'

// Public category listings /przepisy/{kategoria} (E01-S09, extended by E01-S16) share the app chrome with /przepis/{slug}.
export default function KategoriaLayout({ children }: { children: ReactNode }) {
  return <AppShell>{children}</AppShell>
}
