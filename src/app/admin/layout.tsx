import type { Metadata } from 'next'
import type { ReactNode } from 'react'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { getStaff } from '@/lib/staff/context'
import { visibleResources } from '@/lib/staff/registry'

// The panel is for staff only: never indexed, and a user without a role gets the
// same 404 as any unknown path.
export const metadata: Metadata = {
  title: 'Panel · Zapisz Przepis',
  robots: { index: false, follow: false },
}

export default async function AdminLayout({ children }: { children: ReactNode }) {
  const staff = await getStaff()
  if (!staff) notFound()

  const resources = visibleResources(staff.permissions)

  return (
    <div className="min-h-screen bg-surface-2 text-[17px] text-ink">
      <header className="border-b border-border-card bg-white">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center gap-x-6 gap-y-2 px-4 py-3">
          <Link href="/admin" className="min-h-touch inline-flex items-center font-semibold">
            Panel
          </Link>
          <nav aria-label="Panel administracyjny" className="flex flex-wrap gap-x-2">
            {resources.map((r) => (
              <Link
                key={r.name}
                href={r.path}
                className="min-h-touch inline-flex items-center px-2 text-ink-soft underline-offset-4 hover:text-action-hover hover:underline"
              >
                {r.label}
              </Link>
            ))}
            {staff.permissions.has('tokens.own') && (
              <Link
                href="/admin/tokeny"
                className="min-h-touch inline-flex items-center px-2 text-ink-soft underline-offset-4 hover:text-action-hover hover:underline"
              >
                Moje tokeny
              </Link>
            )}
          </nav>
          <Link
            href="/"
            className="min-h-touch ml-auto inline-flex items-center text-ink-soft underline underline-offset-4 hover:text-action-hover"
          >
            Wróć do serwisu
          </Link>
        </div>
      </header>
      <main className="mx-auto max-w-5xl px-4 py-6">{children}</main>
    </div>
  )
}
