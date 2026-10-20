'use client'

import type { MouseEvent } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { X } from 'lucide-react'

/**
 * Below lg /szukaj is a full screen of its own (handoff v8 screen 4, E01-S26): this
 * bar replaces the app header, „✕ Zamknij” on the left and the title on the right.
 * „Zamknij” goes back to where the search was opened from; with no history (a new
 * tab, a shared link) or without JS it is a link to the start page. From lg the app
 * header is back and the title is for screen readers only.
 */
export function SearchScreenBar() {
  const router = useRouter()
  function onClick(event: MouseEvent<HTMLAnchorElement>) {
    if (window.history.length > 1) {
      event.preventDefault()
      router.back()
    }
  }
  return (
    <div className="sticky top-0 z-20 flex min-h-16 items-center justify-between gap-3 border-b-2 border-border-card bg-white py-1 pr-4 pl-2 lg:static lg:min-h-0 lg:border-0 lg:p-0">
      <Link
        href="/"
        onClick={onClick}
        className="inline-flex h-14 shrink-0 items-center gap-1.5 rounded-field px-2 text-[18px] leading-none font-bold text-ink no-underline! hover:bg-surface-3 lg:hidden"
      >
        <X aria-hidden="true" className="h-6 w-6" />
        Zamknij
      </Link>
      <h1 className="text-[20px] font-bold text-ink lg:sr-only">Szukaj przepisu</h1>
    </div>
  )
}
