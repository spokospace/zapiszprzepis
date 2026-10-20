'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { History, TrendingUp } from 'lucide-react'
import { popularMinusRecent } from '@/lib/home'
import { searchPath } from '@/lib/routes'
import { useRecentSearches } from './use-recent-searches'
import { useFieldValue } from './use-field-value'

const CHIP =
  'inline-flex min-h-12 shrink-0 items-center gap-1.5 rounded-pill border-2 px-4 text-[17px] font-bold whitespace-nowrap text-ink no-underline!'

/**
 * How far the on-screen keyboard pushes the visual viewport up. Chrome on Android
 * resizes the layout instead (`interactive-widget=resizes-content`), so this stays
 * 0 there; iOS Safari only shrinks the visual viewport, so the bar is lifted by hand.
 */
function useKeyboardInset(): number {
  const [inset, setInset] = useState(0)
  useEffect(() => {
    const vv = window.visualViewport
    if (!vv) return
    const viewport = vv
    function update() {
      setInset(Math.max(0, Math.round(window.innerHeight - viewport.height - viewport.offsetTop)))
    }
    viewport.addEventListener('resize', update)
    viewport.addEventListener('scroll', update)
    update()
    return () => {
      viewport.removeEventListener('resize', update)
      viewport.removeEventListener('scroll', update)
    }
  }, [])
  return inset
}

/**
 * „Ostatnio i często szukane” (handoff v8 screen 4, E01-S26): one-tap queries stuck
 * to the bottom of the phone screen, just above the keyboard, while the field is
 * empty or holds one or two letters. Recent queries first (signed in only), then the
 * popular ones; the row scrolls sideways inside the bar, never the page.
 */
export function QuickSearchBar({
  fieldId,
  initialValue,
  isAuthenticated,
}: {
  fieldId: string
  initialValue: string
  isAuthenticated: boolean
}) {
  const value = useFieldValue(fieldId, initialValue)
  const inset = useKeyboardInset()
  const { recent } = useRecentSearches()
  if (value.trim().length > 2) return null

  const mine = isAuthenticated ? recent : []
  const popular = popularMinusRecent(mine)

  return (
    <nav
      aria-labelledby="quick-search-heading"
      style={{ bottom: inset }}
      className="fixed inset-x-0 bottom-0 z-30 border-t-2 border-border-card bg-white pt-3 pb-[max(12px,env(safe-area-inset-bottom))] lg:hidden"
    >
      <p id="quick-search-heading" className="mb-2 px-4 text-[16px] font-bold text-ink">
        {isAuthenticated ? 'Ostatnio i często szukane' : 'Często szukane'}
      </p>
      <ul className="flex gap-2 overflow-x-auto px-4 pb-1">
        {mine.map((term) => (
          <li key={`r-${term}`} className="shrink-0">
            <Link href={searchPath(term)} className={`${CHIP} border-field bg-white hover:bg-surface-3`}>
              <History aria-hidden="true" className="h-5 w-5" />
              {term}
            </Link>
          </li>
        ))}
        {popular.map((term) => (
          <li key={`p-${term}`} className="shrink-0">
            <Link href={searchPath(term)} className={`${CHIP} border-accent-dark bg-surface-accent hover:bg-surface-accent-2`}>
              <TrendingUp aria-hidden="true" className="h-5 w-5" />
              {term}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  )
}
