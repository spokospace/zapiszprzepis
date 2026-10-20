'use client'

import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { chipClasses } from '@/app/components/ui/chip'
import { CardCarousel } from '@/app/components/card-carousel'
import { sortVersions, parseVersionsSort, type DishVersionRow, type VersionsSort } from '@/lib/dish-versions'

const STORAGE_KEY = 'zp.versionsSort'

const OPTIONS: { key: VersionsSort; label: string; announce: string }[] = [
  { key: 'popularne', label: 'Najpopularniejsze', announce: 'najpopularniejsze' },
  { key: 'nowe', label: 'Najnowsze', announce: 'najnowsze' },
  { key: 'szybkie', label: 'Najszybsze', announce: 'najszybsze' },
]

/**
 * The versions list with its sort control (E01-S21). The cards are rendered on
 * the server (they are the shared RecipeCard, which pulls in server-only code)
 * and passed in keyed by id; this island only re-orders them. Server-rendered in
 * `initialOrder` (from ?wersje=), so it works without JS — each segment is a real
 * link that reloads with the new order. With JS a click re-sorts the rows already
 * on the page (no request), updates the URL with replaceState and announces the
 * change; the choice is remembered per viewer in localStorage and applied on mount
 * only when the URL did not pin an order.
 */
export function DishVersionsSort({
  versions,
  initialOrder,
  label,
  cards,
}: {
  versions: DishVersionRow[]
  initialOrder: VersionsSort
  /** The section heading, naming the carousel's buttons for screen readers. */
  label: string
  /** Server-rendered cards keyed by recipe id, re-ordered here without a request. */
  cards: Record<number, ReactNode>
}) {
  const [order, setOrder] = useState<VersionsSort>(initialOrder)
  const [announce, setAnnounce] = useState('')

  // The stored choice wins only when the URL pins no order (an explicit
  // ?wersje= beats it). Guarded: a private window simply keeps the default.
  useEffect(() => {
    try {
      if (new URLSearchParams(window.location.search).has('wersje')) return
      const stored = window.localStorage.getItem(STORAGE_KEY)
      // localStorage is unavailable during SSR, so this must apply after mount —
      // a lazy initializer would mismatch the server HTML. The re-sort is below
      // the fold, so there is no visible jump.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      if (stored) setOrder(parseVersionsSort(stored))
    } catch {
      // storage blocked — keep the server order
    }
  }, [])

  const rows = useMemo(() => sortVersions(versions, order), [versions, order])

  function pick(event: React.MouseEvent, key: VersionsSort) {
    event.preventDefault()
    setOrder(key)
    setAnnounce(`Kolejność: ${OPTIONS.find((o) => o.key === key)?.announce ?? ''}`)
    try {
      window.localStorage.setItem(STORAGE_KEY, key)
    } catch {
      // ignore
    }
    try {
      const url = new URL(window.location.href)
      url.searchParams.set('wersje', key)
      url.hash = 'inne-przepisy'
      window.history.replaceState(null, '', url)
    } catch {
      // ignore
    }
  }

  return (
    <>
      {versions.length >= 2 && (
        <div role="group" aria-labelledby="wersje-kolejnosc" className="mb-5 flex flex-wrap items-center gap-2">
          {/* wrap-anywhere: a flex item never shrinks below its longest word otherwise (WCAG 1.4.10). */}
          <span id="wersje-kolejnosc" className="mr-1 text-[16px] font-bold wrap-anywhere text-ink-soft">
            Kolejność:
          </span>
          {OPTIONS.map(({ key, label }) => {
            const active = order === key
            return (
              <a
                key={key}
                href={`?wersje=${key}#inne-przepisy`}
                aria-current={active ? 'true' : undefined}
                onClick={(e) => pick(e, key)}
                className={chipClasses(active)}
              >
                {active ? '✓ ' : ''}
                {label}
              </a>
            )
          })}
        </div>
      )}

      {/* A swipeable strip with buttons on a phone; one card a row from sm, two from lg.
          Keyed by the order, so a re-sort starts the strip again at its first card. */}
      <CardCarousel
        key={order}
        label={label}
        layout="rows"
        items={rows.map((v) => ({ key: v.id, card: cards[v.id] }))}
      />

      <div role="status" aria-live="polite" className="sr-only">
        {announce}
      </div>
    </>
  )
}
