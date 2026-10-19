'use client'

import type { MouseEvent } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { ArrowLeft } from 'lucide-react'

type Props = {
  /** Signed-in header: three buttons on the right, so below 360 px the link must stack. */
  crowded: boolean
  className?: string
}

const ROW = 'flex-row gap-1.5 text-[18px]'
// Below 360 px the 18 px row does not fit beside Dodaj + Powiadomienia + MENU, so
// it stacks like them: arrow over a 13 px caption, still 56 px tall.
const STACK_BELOW_360 = 'flex-col gap-0.5 text-[13px] min-[360px]:flex-row min-[360px]:gap-1.5 min-[360px]:text-[18px]'

/**
 * "← Wróć" in place of the logo on the screens below the start page (handoff 1c:
 * C2 search, 2a settings, A7 /dodaj, 3c, 5 notifications, category, profile) —
 * 18 px bold, a 56 px target. It goes back in history like the browser button;
 * with no history (a new tab, a shared link) or without JS it is a plain link to
 * the start page. A recipe page keeps the logo: its list bar is the way back.
 */
export function PageBackLink({ crowded, className }: Props) {
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
      className={`-ml-2 inline-flex h-14 shrink-0 items-center justify-center rounded-field px-2 leading-none font-bold text-ink no-underline! hover:bg-surface-3 ${crowded ? STACK_BELOW_360 : ROW} ${className ?? ''}`}
    >
      <ArrowLeft aria-hidden="true" className="h-6 w-6" />
      Wróć
    </Link>
  )
}
