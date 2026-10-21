'use client'

import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { ArrowDownUp, Check, ChevronDown } from 'lucide-react'
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
 * The versions list with its sort control (E01-S21, E01-S31 §4b). The cards are
 * rendered on the server (they are the shared RecipeCard, which pulls in
 * server-only code) and passed in keyed by id; this island only re-orders them.
 * Server-rendered in `initialOrder` (from ?wersje=), so it works without JS — each
 * control is a real link that reloads with the new order. With JS a click re-sorts
 * the rows already on the page (no request), updates the URL with replaceState and
 * announces the change; the choice is remembered per viewer in localStorage and
 * applied on mount only when the URL did not pin an order.
 *
 * Desktop keeps the three pills (11a); on a phone they wrap into two rows, so below
 * md the control is a single „Kolejność: {wybrana} ▾” button that opens the options
 * as a `<details>` disclosure (11b) — one tap, full names, closes on Esc / outside
 * click, focus returns to the button.
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
  const detailsRef = useRef<HTMLDetailsElement>(null)
  const summaryRef = useRef<HTMLElement>(null)

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

  // Below md the dropdown is a native `<details>`; close it on Esc (focus back on
  // the button) and on a click outside, the way a listbox would (E01-S31 §4b).
  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape' && detailsRef.current?.open) closeMenu(true)
    }
    function onPointerDown(event: PointerEvent) {
      const details = detailsRef.current
      if (details?.open && !details.contains(event.target as Node)) details.open = false
    }
    document.addEventListener('keydown', onKeyDown)
    document.addEventListener('pointerdown', onPointerDown)
    return () => {
      document.removeEventListener('keydown', onKeyDown)
      document.removeEventListener('pointerdown', onPointerDown)
    }
  }, [])

  const rows = useMemo(() => sortVersions(versions, order), [versions, order])
  const current = OPTIONS.find((o) => o.key === order) ?? OPTIONS[0]

  /** Imperatively close the uncontrolled dropdown, optionally returning focus to its button. */
  function closeMenu(refocus = false) {
    const details = detailsRef.current
    if (details) details.open = false
    if (refocus) summaryRef.current?.focus()
  }

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
        <>
          {/* Desktop (11a): the three pills, wrapping only from md where there is room. */}
          <div
            role="group"
            aria-labelledby="wersje-kolejnosc"
            className="mb-5 hidden flex-wrap items-center gap-2 md:flex"
          >
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

          {/* Phone (11b): one compact button that shows the current choice and opens the
              options. A `<details>` so it still works without JS (the links reload with
              ?wersje=); with JS the clicks re-sort in place and close the menu. */}
          <details ref={detailsRef} className="group relative mb-5 md:hidden">
            <summary
              ref={summaryRef}
              aria-label={`Kolejność: ${current.label}. Zmień kolejność`}
              className="inline-flex min-h-[48px] max-w-full cursor-pointer list-none items-center gap-2 rounded-pill border-2 border-ink px-3.5 text-[16px] font-bold text-ink [&::-webkit-details-marker]:hidden"
            >
              <ArrowDownUp aria-hidden="true" className="h-[18px] w-[18px] shrink-0" />
              <span className="min-w-0 wrap-anywhere">
                <span className="font-normal text-ink-soft">Kolejność: </span>
                {current.label}
              </span>
              <ChevronDown
                aria-hidden="true"
                className="h-[18px] w-[18px] shrink-0 transition-transform group-open:rotate-180"
              />
            </summary>
            <ul className="absolute z-10 mt-2 flex w-[min(20rem,calc(100vw-2rem))] flex-col overflow-hidden rounded-tile border-2 border-ink bg-white shadow-[0_8px_24px_rgba(17,24,39,.12)]">
              {OPTIONS.map(({ key, label }) => {
                const active = order === key
                return (
                  <li key={key} className="border-t border-border-card-2 first:border-t-0">
                    <a
                      href={`?wersje=${key}#inne-przepisy`}
                      aria-current={active ? 'true' : undefined}
                      onClick={(e) => {
                        pick(e, key)
                        closeMenu(true)
                      }}
                      className={`flex min-h-[56px] items-center justify-between gap-2 px-4 text-[17px] no-underline! ${
                        active ? 'bg-surface-3 font-bold text-ink' : 'text-ink hover:bg-surface-2'
                      }`}
                    >
                      <span className="min-w-0 wrap-anywhere">{label}</span>
                      {active && <Check aria-hidden="true" className="h-5 w-5 shrink-0" />}
                    </a>
                  </li>
                )
              })}
            </ul>
          </details>
        </>
      )}

      {/* A swipeable strip with buttons on a phone; one card a row from sm, two from lg.
          Keyed by the order, so a re-sort starts the strip again at its first card. */}
      <CardCarousel
        key={order}
        label={label}
        layout="versions"
        items={rows.map((v) => ({ key: v.id, card: cards[v.id] }))}
      />

      <div role="status" aria-live="polite" className="sr-only">
        {announce}
      </div>
    </>
  )
}
