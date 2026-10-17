'use client'

import { useMemo, useSyncExternalStore } from 'react'
import Link from 'next/link'
import { ArrowLeft, ArrowRight } from 'lucide-react'
import { useSessionStorage } from '@/app/components/ui/use-session-storage'
import { listStorageKey, locate, parseSnapshot, type ListItem, type ListKey, type ListPosition } from '@/lib/recipe-list-context'
import { recipePath } from '@/lib/routes'

interface RecipeListProps {
  slug: string
  /** A whitelisted ?from key, or null when the visitor did not come from a list. */
  from: ListKey | null
  /** Server-computed category context: the fallback, and the whole bar without ?from. */
  fallback: ListPosition | null
}

// Fixed height (one 48 px row + padding), so the placeholder and the filled bar
// occupy the same space and nothing below jumps on hydration.
const BAR = 'mb-6 flex min-h-[74px] items-center justify-between gap-3 rounded-card border border-border-card-2 px-3 py-3'

// A button-shaped link: bordered, so no underline (as in the header's "Dodaj").
const NAV = 'flex min-h-[64px] items-center gap-3 rounded-field border-2 px-4 py-2 leading-tight no-underline!'

const noop = () => () => {}

/** false during SSR and hydration, true afterwards — without a setState-in-effect. */
function useHydrated(): boolean {
  return useSyncExternalStore(noop, () => true, () => false)
}

type ListState =
  | { kind: 'pending' }
  | { kind: 'none' }
  | { kind: 'ready'; position: ListPosition; linkFrom: ListKey | null }

/**
 * Where this recipe sits in the list the visitor came from (E01-S07). With a valid
 * ?from, this tab's snapshot of that list, falling back to the category context
 * when the recipe is not in it (a new tab, a stale or shared link). Without ?from,
 * the category context straight from the server, with no client swap.
 * SSR and hydration cannot read sessionStorage: with ?from it is `pending` until
 * the client knows which list (if any) this tab came from, so no "N z M" is ever
 * shown and then replaced.
 */
function useListPosition({ slug, from, fallback }: RecipeListProps): ListState {
  const hydrated = useHydrated()
  const [raw] = useSessionStorage(from ? listStorageKey(from) : '')
  const fromList = useMemo(() => (from ? locate(parseSnapshot(raw), slug) : null), [from, raw, slug])

  // A placeholder is reserved only when the category fallback would show a bar
  // anyway, so a fallback that renders nothing never collapses after hydration.
  if (from && !hydrated) return fallback && fallback.total >= 2 ? { kind: 'pending' } : { kind: 'none' }

  const position = fromList ?? fallback
  if (!position || position.total < 2) return { kind: 'none' }
  // Prev/next keep ?from only while walking the visitor's own list.
  return { kind: 'ready', position, linkFrom: fromList ? from : null }
}

/** "← {lista}" + "N z M" at the top of the recipe (handoff C3, item 1). */
export function RecipeListBar(props: RecipeListProps) {
  const state = useListPosition(props)
  if (state.kind === 'none') return null
  if (state.kind === 'pending') return <div aria-hidden="true" className={BAR} />

  const { position } = state
  return (
    <nav aria-label="Lista przepisów" className={`${BAR} text-[17px] font-bold text-ink`}>
      <Link href={position.href} className="inline-flex min-h-[48px] items-center underline hover:text-action-hover">
        ← {position.label}
      </Link>
      <span className="shrink-0">
        <span aria-hidden="true">
          {position.index} z {position.total}
        </span>
        <span className="sr-only">
          Przepis {position.index} z {position.total} na liście {position.label}
        </span>
      </span>
    </nav>
  )
}

function NavLink({
  item,
  from,
  direction,
  listLabel,
}: {
  item: ListItem | null
  from: ListKey | null
  direction: 'prev' | 'next'
  listLabel: string
}) {
  // At a list end: nothing to stack on mobile; an empty cell from lg so the other
  // button keeps its side.
  if (!item) return <span aria-hidden="true" className="hidden lg:block" />

  const prev = direction === 'prev'
  const word = prev ? 'Poprzedni' : 'Następny'
  const Arrow = prev ? ArrowLeft : ArrowRight
  return (
    <Link
      href={recipePath(item.slug, { from })}
      className={`${NAV} ${prev ? '' : 'justify-between'} border-field bg-white text-ink hover:bg-surface-3`}
    >
      {prev && <Arrow aria-hidden="true" size={24} className="shrink-0" />}
      <span className="flex flex-col">
        {/* "Poprzedni przepis" on mobile; from lg the list is named (A9: "Poprzedni w wynikach „dynia”"). */}
        <span className="text-[14px] font-bold text-ink-soft">
          <span className="lg:hidden">{word} przepis</span>
          <span className="hidden lg:inline">
            {word} na liście: {listLabel}
          </span>
        </span>
        {/* The full title, never truncated (handoff C3, item 12). */}
        <span className="text-[18px] font-bold">{item.title}</span>
      </span>
      {!prev && <Arrow aria-hidden="true" size={24} className="shrink-0" />}
    </Link>
  )
}

/**
 * Poprzedni / Następny at the end of the recipe (handoff C3, item 12): stacked 64 px
 * buttons on mobile, side by side from lg.
 */
export function RecipeListNav(props: RecipeListProps) {
  const state = useListPosition(props)
  // Nothing is reserved while pending: the nav sits at the end of the page, below
  // the fold on load, and its height depends on which neighbours exist.
  if (state.kind !== 'ready') return null

  const { position, linkFrom } = state
  return (
    <nav aria-label="Poprzedni i następny przepis" className="mb-10 grid grid-cols-1 gap-2 lg:grid-cols-2 lg:gap-4">
      <NavLink item={position.prev} from={linkFrom} direction="prev" listLabel={position.label} />
      <NavLink item={position.next} from={linkFrom} direction="next" listLabel={position.label} />
    </nav>
  )
}
