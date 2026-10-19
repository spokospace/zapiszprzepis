'use client'

import type { MouseEvent } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { ArrowLeft } from 'lucide-react'

type Props = {
  className?: string
}

/**
 * "← Wróć" in place of the logo on the screens below the start page (handoff 1c:
 * C2 search, 2a settings, A7 /dodaj, 3c, 5 notifications, category, profile) —
 * 18 px bold, a 56 px target. It goes back in history like the browser button;
 * with no history (a new tab, a shared link) or without JS it is a plain link to
 * the start page. A recipe page keeps the logo: its list bar is the way back.
 *
 * One 18 px row at every width: beside Dodaj + MENU (signed in) or MENU alone
 * (guest) it fits at 320 px. It stacked below 360 px only while the bell was in
 * the phone header too (#323).
 */
export function PageBackLink({ className }: Props) {
  const router = useRouter()
  function onClick(event: MouseEvent<HTMLAnchorElement>) {
    if (window.history.length > 1) {
      event.preventDefault()
      router.back()
    }
  }
  return (
    <Link
      href="/"
      aria-label="Wróć"
      onClick={onClick}
      className={`-ml-2 inline-flex h-14 shrink-0 flex-row items-center justify-center gap-1.5 rounded-field px-2 text-[18px] leading-none font-bold text-ink no-underline! hover:bg-surface-3 ${className ?? ''}`}
    >
      <ArrowLeft aria-hidden="true" className="h-6 w-6" />
      Wróć
    </Link>
  )
}
