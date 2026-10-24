'use client'

import type { ReactNode } from 'react'
import { signOut } from '@/app/(actions)/sign-out'
import { clearPrivateCaches } from '@/lib/pwa-utils'

/**
 * The sign-out form. Submitting it also empties the service worker's page
 * caches, so on a shared phone the next person cannot read the signed-in
 * pages offline (#373).
 */
export function SignOutForm({ className, children }: { className?: string; children: ReactNode }) {
  return (
    <form action={signOut} onSubmit={() => void clearPrivateCaches()} className={className}>
      {children}
    </form>
  )
}
