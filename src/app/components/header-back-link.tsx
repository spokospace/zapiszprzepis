'use client'

import type { MouseEvent } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { ArrowLeft } from 'lucide-react'
import type { HeaderBackTarget } from './header-back-target'

type Props = {
  className?: string
  /**
   * The list the visitor came from (recipe page, C3 „← Wyniki”, E01-S28): a plain
   * link to it. Without one, „← Wróć” goes back in history.
   */
  target?: HeaderBackTarget | null
}

const BACK =
  '-ml-2 inline-flex h-14 min-w-0 flex-row items-center justify-center gap-1.5 rounded-pill px-2 text-[18px] leading-none font-bold text-ink no-underline! hover:bg-surface-3'

/**
 * "← Wróć" in place of the logo on the screens below the start page (handoff 1c:
 * C2 search, 2a settings, A7 /dodaj, 3c, 5 notifications, category, profile, and
 * the recipe page, C3) — 18 px bold, a 56 px target. It goes back in history like
 * the browser button; with no history (a new tab, a shared link) or without JS it
 * is a plain link to the start page. On a recipe opened from a list it names that
 * list instead („← Wyniki”, „← Ciasteczka”) and links to it.
 *
 * One 18 px row at every width: beside „Szukaj” + MENU it fits at 320 px; a long
 * list name is cut with an ellipsis rather than pushing the buttons off screen.
 */
export function PageBackLink({ className, target }: Props) {
  const router = useRouter()
  function onClick(event: MouseEvent<HTMLAnchorElement>) {
    if (window.history.length > 1) {
      event.preventDefault()
      router.back()
    }
  }
  if (target) {
    return (
      <Link href={target.href} aria-label={`Wróć: ${target.label}`} className={`${BACK} ${className ?? ''}`}>
        <ArrowLeft aria-hidden="true" className="h-6 w-6 shrink-0" />
        <span className="truncate py-1">{target.label}</span>
      </Link>
    )
  }
  return (
    <Link href="/" aria-label="Wróć" onClick={onClick} className={`${BACK} shrink-0 ${className ?? ''}`}>
      <ArrowLeft aria-hidden="true" className="h-6 w-6" />
      Wróć
    </Link>
  )
}
