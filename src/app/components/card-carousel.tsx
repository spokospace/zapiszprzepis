'use client'

import { useCallback, useId, useRef, useSyncExternalStore, type Key, type ReactNode } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { buttonClasses } from '@/app/components/ui/button'

/**
 * On a phone a swipeable strip running to the screen edges (it cancels
 * PageContainer's px-4); from sm the 2-column grid, 4 from lg (E01-S17). The
 * strip scrolls inside itself, so the page never scrolls sideways (WCAG 1.4.10).
 * Not exported: a server component importing a string from a 'use client'
 * module gets a client reference, not the string.
 */
const CAROUSEL_CLASS =
  '-mx-4 flex snap-x snap-mandatory scroll-px-4 gap-3 overflow-x-auto px-4 pb-2 sm:mx-0 sm:grid sm:grid-cols-2 sm:overflow-visible sm:px-0 sm:pb-0 lg:grid-cols-4 lg:gap-5'

/** One card: 3/4 of the screen on a phone, so the next one peeks in; a grid cell from sm. */
const CAROUSEL_ITEM_CLASS = 'w-3/4 shrink-0 snap-start sm:w-auto'

/** Where the strip stands; `none` when every card fits (from sm, or a single card). */
type Edge = 'start' | 'middle' | 'end' | 'none'

function edgeOf(list: HTMLElement | null): Edge {
  if (!list) return 'start'
  if (list.scrollWidth <= list.clientWidth + 1) return 'none'
  if (list.scrollLeft <= 1) return 'start'
  if (list.scrollLeft + list.clientWidth >= list.scrollWidth - 1) return 'end'
  return 'middle'
}

// A label never breaks mid-word: from 360 px the two share a row, at 320 px they stack, full width.
const STEP_BUTTON = `${buttonClasses('outline', 'md')} grow whitespace-nowrap aria-disabled:cursor-not-allowed aria-disabled:opacity-50`

/**
 * A row of cards inside a page (home "Ostatnio dodane", recipe "Podobne"). No
 * gesture without a button (design handoff): on a phone "Poprzednie" /
 * "Następne" under the strip move it by one card, and its links stay reachable
 * with Tab, which scrolls them in. The buttons render on the server too, so the
 * page doesn't shift on hydration; they hide once every card turns out to fit.
 */
export function CardCarousel({ label, items }: { label: string; items: { key: Key; card: ReactNode }[] }) {
  const listRef = useRef<HTMLUListElement>(null)
  const listId = useId()
  const subscribe = useCallback((onChange: () => void) => {
    const list = listRef.current
    list?.addEventListener('scroll', onChange, { passive: true })
    window.addEventListener('resize', onChange)
    return () => {
      list?.removeEventListener('scroll', onChange)
      window.removeEventListener('resize', onChange)
    }
  }, [])
  const edge = useSyncExternalStore(subscribe, () => edgeOf(listRef.current), () => 'start' as Edge)

  function step(direction: 1 | -1) {
    const list = listRef.current
    const card = list?.querySelector('li')
    if (!list || !card) return
    const gap = parseFloat(getComputedStyle(list).columnGap) || 0
    const smooth = !window.matchMedia('(prefers-reduced-motion: reduce)').matches
    list.scrollBy({ left: direction * (card.getBoundingClientRect().width + gap), behavior: smooth ? 'smooth' : 'auto' })
  }

  // aria-disabled, not disabled: a disabled button drops the keyboard focus that just pressed it.
  const stepButton = (direction: 1 | -1, atEdge: boolean, children: ReactNode) => (
    <button
      type="button"
      aria-controls={listId}
      aria-disabled={atEdge}
      onClick={() => !atEdge && step(direction)}
      className={STEP_BUTTON}
    >
      {children}
    </button>
  )

  return (
    <>
      <ul ref={listRef} id={listId} className={CAROUSEL_CLASS}>
        {items.map(({ key, card }) => (
          <li key={key} className={CAROUSEL_ITEM_CLASS}>
            {card}
          </li>
        ))}
      </ul>
      {edge !== 'none' && (
        <div className="mt-2 flex flex-wrap gap-2 sm:hidden">
          {stepButton(
            -1,
            edge === 'start',
            <>
              <ChevronLeft aria-hidden="true" className="h-5 w-5 shrink-0" />
              Poprzednie<span className="sr-only">: {label}</span>
            </>,
          )}
          {stepButton(
            1,
            edge === 'end',
            <>
              Następne<span className="sr-only">: {label}</span>
              <ChevronRight aria-hidden="true" className="h-5 w-5 shrink-0" />
            </>,
          )}
        </div>
      )}
    </>
  )
}
