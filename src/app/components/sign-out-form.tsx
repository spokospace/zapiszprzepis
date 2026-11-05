'use client'

import type { ReactNode } from 'react'
import { signOut } from '@/app/(actions)/sign-out'
import { browserSession } from '@/lib/browser-session'
import { clearPrivateCaches } from '@/lib/pwa-utils'

/**
 * The sign-out form. Submitting it also empties the service worker's page
 * caches, so on a shared phone the next person cannot read the signed-in
 * pages offline (#373), and the browser's copy of the session.
 */
export function SignOutForm({ className, children }: { className?: string; children: ReactNode }) {
  function onSubmit() {
    browserSession.clear()
    void clearPrivateCaches()
  }
  return (
    <form action={signOut} onSubmit={onSubmit} className={className}>
      {children}
    </form>
  )
}
