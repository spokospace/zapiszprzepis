'use client'

import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { ArrowDownUp, Check, ChevronDown } from 'lucide-react'
import { useHydrated } from '@/app/components/ui/use-hydrated'
import { polishPlural } from '@/lib/recipe-meta'
import { sortVersions, parseVersionsSort, type DishVersionRow, type VersionsSort } from '@/lib/dish-versions'

const STORAGE_KEY = 'zp.versionsSort'

/** Rows shown before „Pokaż wszystkie” (handoff 2026-10-28 §6). */
export const VERSIONS_SHOWN = 4

const OPTIONS: { key: VersionsSort; label: string; announce: string }[] = [
  { key: 'popularne', label: 'Najpopularniejsze', announce: 'najpopularniejsze' },
  { key: 'nowe', label: 'Najnowsze', announce: 'najnowsze' },
  { key: 'szybkie', label: 'Najszybsze', announce: 'najszybsze' },
]

/** "Pokaż wszystkie 9 wersji", "… 22 wersje". */
export function showAllLabel(n: number): string {
  return `Pokaż wszystkie ${n} ${polishPlural(n, 'wersję', 'wersje', 'wersji')}`
}

/**
 * The versions list with its sort control (E01-S21; handoff 2026-10-28 §6). The rows are
 * rendered on the server and passed in keyed by id; this island only re-orders them and
 * opens the rest of the list. Server-rendered in `initialOrder` (from ?wersje=), so it
 * works without JS — each control is a real link that reloads with the new order, and
 * every row shows (the list is cut to four only after hydration, below the fold). With JS
 * a click re-sorts the rows already on the page (no request), updates the URL with
 * replaceState and announces the change; the choice is remembered per viewer in
 * localStorage and applied on mount only when the URL did not pin an order.
 *
 * From md the control is the handoff's segmented switch beside the heading. Below md the
 * three names do not fit a phone row, so it stays a single „Kolejność: {wybrana} ▾” button
 * opening the options as a `<details>` disclosure (11b).
 */
export function DishVersionsSort({
  versions,
  initialOrder,
  rows,
  header,
  legend,
}: {
  versions: DishVersionRow[]
  initialOrder: VersionsSort
  /** Server-rendered rows keyed by recipe id, re-ordered here without a request. */
  rows: Record<number, ReactNode>
  /** The heading and its caption, sharing a line with the switch from md. */
  header: ReactNode
  /** What the difference chips mean, over the list. */
  legend: ReactNode
}) {
  const [order, setOrder] = useState<VersionsSort>(initialOrder)
  const [announce, setAnnounce] = useState('')
  const [expanded, setExpanded] = useState(false)
  const hydrated = useHydrated()
  const detailsRef = useRef<HTMLDetailsElement>(null)
  const summaryRef = useRef<HTMLElement>(null)
  const listRef = useRef<HTMLUListElement>(null)

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

  const sorted = useMemo(() => sortVersions(versions, order), [versions, order])
  const current = OPTIONS.find((o) => o.key === order) ?? OPTIONS[0]
  const collapsed = hydrated && !expanded && sorted.length > VERSIONS_SHOWN

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

  // „Pokaż wszystkie” goes away when pressed, so focus moves to the first row it revealed
  // rather than falling back to the page.
  function showAll() {
    setExpanded(true)
    requestAnimationFrame(() => {
      listRef.current?.querySelectorAll<HTMLAnchorElement>('h3 a')[VERSIONS_SHOWN]?.focus()
    })
  }

  return (
    <>
      <div className="flex flex-wrap items-start justify-between gap-x-6 gap-y-4">
        {header}
        {versions.length >= 2 && (
          <div role="group" aria-labelledby="wersje-kolejnosc" className="hidden md:block">
            <span id="wersje-kolejnosc" className="sr-only">
              Kolejność
            </span>
            {/* The segmented switch: a grey track, the chosen option a white pill. */}
            <div className="inline-flex rounded-pill bg-[#f3f4f6] p-1">
              {OPTIONS.map(({ key, label }) => {
                const active = order === key
                return (
                  <a
                    key={key}
                    href={`?wersje=${key}#inne-przepisy`}
                    aria-current={active ? 'true' : undefined}
                    onClick={(e) => pick(e, key)}
                    className={`inline-flex min-h-12 items-center rounded-pill px-4 text-[16px] font-bold no-underline! ${
                      active ? 'bg-white text-ink shadow-[0_1px_4px_rgba(17,24,39,0.18)]' : 'text-ink-soft hover:text-ink'
                    }`}
                  >
                    {label}
                  </a>
                )
              })}
            </div>
          </div>
        )}
      </div>

      {versions.length >= 2 && (
        // Phone (11b): one compact button that shows the current choice and opens the
        // options. A `<details>` so it still works without JS (the links reload with
        // ?wersje=); with JS the clicks re-sort in place and close the menu.
        <details ref={detailsRef} className="group relative mt-4 md:hidden">
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
            <ChevronDown aria-hidden="true" className="h-[18px] w-[18px] shrink-0 transition-transform group-open:rotate-180" />
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
      )}

      {legend}

      <ul ref={listRef} className="mt-4 border-b border-border-card">
        {sorted.map((v, i) => (
          <li key={v.id} className={collapsed && i >= VERSIONS_SHOWN ? 'hidden' : undefined}>
            {rows[v.id]}
          </li>
        ))}
      </ul>

      {collapsed && (
        <button
          type="button"
          onClick={showAll}
          className="mt-5 inline-flex min-h-[56px] items-center gap-2 rounded-pill border-2 border-ink px-6 text-[17px] font-bold text-ink hover:bg-surface-3"
        >
          {showAllLabel(sorted.length)}
          <ChevronDown aria-hidden="true" className="h-5 w-5 shrink-0" />
        </button>
      )}

      <div role="status" aria-live="polite" className="sr-only">
        {announce}
      </div>
    </>
  )
}
