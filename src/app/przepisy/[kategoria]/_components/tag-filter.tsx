'use client'

import { useCallback, useEffect, useId, useMemo, useOptimistic, useRef, useState } from 'react'
import type { MouseEvent } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { chipClasses } from '@/app/components/ui/chip'
import { recipesNoun } from '@/app/components/app-menu-model'
import { useListTransition } from '@/app/components/list-transition'

export interface TagChip {
  value: string
  label: string
  count: number
  selected: boolean
  /** The category URL with this tag toggled. */
  href: string
}

/** The selection after a tap on `value`: toggled, as the server will answer (the optimistic state, #435). */
export function toggleTag(current: ReadonlySet<string>, value: string): Set<string> {
  const next = new Set(current)
  if (!next.delete(value)) next.add(value)
  return next
}

/** Chips shown before "Pokaż wszystkie (N)". Selected chips sort first, so they are always visible. */
export const VISIBLE_CHIPS = 8

/**
 * The tag chips of the public category page (E01-S16). Each chip is a link that
 * toggles its tag in `?tag=`, so the filter works before hydration and is
 * shareable; this component adds the "Pokaż wszystkie" toggle from md and, on a
 * phone, a single row that scrolls sideways with „Więcej ›” / „‹ Wstecz” buttons
 * (style 1b). The row scrolls inside itself, so the page never does (WCAG 1.4.10);
 * every chip is in it, so the toggle is not needed there.
 */
export function TagFilter({ chips, question }: { chips: TagChip[]; /** "Jakie ciasteczka?" (screen 6). */ question: string }) {
  const [expanded, setExpanded] = useState(false)
  const listId = useId()
  const router = useRouter()
  const { startTransition } = useListTransition()
  // A tap marks the chip at once; the server answer (the new list, counts and order) replaces it (#435).
  const selectedNow = useMemo(() => new Set(chips.filter((c) => c.selected).map((c) => c.value)), [chips])
  const [selectedValues, toggleSelected] = useOptimistic(selectedNow, toggleTag)

  function onChipClick(event: MouseEvent<HTMLAnchorElement>, chip: TagChip) {
    // A modified click (new tab) and a non-primary button keep the browser's behaviour.
    if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return
    event.preventDefault()
    startTransition(() => {
      toggleSelected(chip.value)
      router.push(chip.href, { scroll: false })
    })
  }

  const hidden = chips.length - VISIBLE_CHIPS
  const scrollerRef = useRef<HTMLUListElement>(null)
  const [canLeft, setCanLeft] = useState(false)
  const [canRight, setCanRight] = useState(false)

  // Phone row: show „Wstecz” / „Więcej” only when there is somewhere to scroll
  // (2 px slack so a sub-pixel scrollWidth never leaves a button stuck on).
  const updateEdges = useCallback(() => {
    const el = scrollerRef.current
    if (!el) return
    setCanLeft(el.scrollLeft > 2)
    setCanRight(el.scrollLeft < el.scrollWidth - el.clientWidth - 2)
  }, [])

  useEffect(() => {
    updateEdges()
    const el = scrollerRef.current
    if (!el) return
    el.addEventListener('scroll', updateEdges, { passive: true })
    window.addEventListener('resize', updateEdges)
    return () => {
      el.removeEventListener('scroll', updateEdges)
      window.removeEventListener('resize', updateEdges)
    }
  }, [updateEdges, chips.length])

  function scrollByPage(direction: 1 | -1) {
    const el = scrollerRef.current
    if (!el) return
    el.scrollBy({ left: direction * Math.max(el.clientWidth - 120, 120), behavior: 'smooth' })
  }

  return (
    <nav aria-labelledby={`${listId}-h`}>
      <h2 id={`${listId}-h`} className="text-[19px] font-bold text-ink">
        {question}
      </h2>
      <p className="mb-3 text-[16px] leading-snug text-ink-soft">
        Możesz zaznaczyć kilka. Pokażemy przepisy, które pasują do wszystkich.
      </p>
      <div className="relative">
      {/* Phone: one row, scrolled sideways, running to the screen edges. From md the chips wrap.
          The vertical padding keeps a chip's focus ring from being clipped by the scroller. */}
      <ul
        ref={scrollerRef}
        id={listId}
        className="-mx-4 -my-1 flex gap-2 overflow-x-auto px-4 py-1 [scrollbar-width:none] sm:-mx-6 sm:px-6 md:mx-0 md:my-0 md:flex-wrap md:overflow-visible md:p-0 [&::-webkit-scrollbar]:hidden"
      >
        {chips.map((chip, i) => (
          <li
            key={chip.value}
            // Past the first chips: hidden from md until „Pokaż wszystkie”, but always in the phone row.
            className={`shrink-0 md:shrink${!expanded && i >= VISIBLE_CHIPS ? ' hidden max-md:block' : ''}`}
          >
            <Link
              href={chip.href}
              scroll={false}
              onClick={(event) => onChipClick(event, chip)}
              className={`${chipClasses(selectedValues.has(chip.value))} max-md:whitespace-nowrap`}
            >
              {/* Name reads "kruche 12 przepisów, wybrany": the visible "kruche 12" stays
                  one contiguous run (WCAG 2.5.3), the explicit spaces keep the two
                  flex items from merging into "kruche12". */}
              <span>
                {selectedValues.has(chip.value) && <span aria-hidden="true">✓ </span>}
                {chip.label}{' '}
              </span>
              <span className="text-[16px] font-normal opacity-80">
                {chip.count}
                <span className="sr-only">
                  {' '}
                  {recipesNoun(chip.count)}
                  {selectedValues.has(chip.value) && ', wybrany'}
                </span>
              </span>
            </Link>
          </li>
        ))}
        {hidden > 0 && (
          // From md only: the phone row already holds every chip.
          <li className="max-md:hidden">
            <button
              type="button"
              aria-expanded={expanded}
              aria-controls={listId}
              onClick={() => setExpanded((v) => !v)}
              // Screen 6: a plain underlined text action under the chips, not another chip-like box.
              // wrap-anywhere, like chipClasses: the label's anonymous flex item would not shrink
              // below its longest word otherwise and widen the page at 320 px / A++ (WCAG 1.4.10).
              className="inline-flex min-h-[48px] items-center px-1 text-[17px] font-bold wrap-anywhere text-ink underline underline-offset-4 hover:text-action-hover"
            >
              {expanded ? 'Pokaż mniej' : `Pokaż wszystkie (${chips.length})`}
            </button>
          </li>
        )}
      </ul>
      {/* Phone only: the gradient buttons fade the chips under them, so their label always sits on white.
          They reach the screen edges (the row bleeds out of the page padding), or a chip would peek out beside them. */}
      {canLeft && (
        <button
          type="button"
          aria-label="Przewiń filtry wstecz"
          onClick={() => scrollByPage(-1)}
          className="absolute top-0 bottom-0 -left-4 flex items-center pr-10 pl-4 text-[16px] font-bold text-ink sm:-left-6 sm:pl-6 md:hidden"
          style={{ background: 'linear-gradient(90deg, #fff 0, #fff calc(100% - 36px), transparent)' }}
        >
          <ChevronLeft aria-hidden="true" className="h-5 w-5" />
          Wstecz
        </button>
      )}
      {canRight && (
        <button
          type="button"
          aria-label="Przewiń filtry dalej"
          onClick={() => scrollByPage(1)}
          className="absolute top-0 -right-4 bottom-0 flex items-center pr-4 pl-10 text-[16px] font-bold text-ink sm:-right-6 sm:pr-6 md:hidden"
          style={{ background: 'linear-gradient(270deg, #fff 0, #fff calc(100% - 36px), transparent)' }}
        >
          Więcej
          <ChevronRight aria-hidden="true" className="h-5 w-5" />
        </button>
      )}
      </div>
    </nav>
  )
}
