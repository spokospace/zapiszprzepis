'use client'

import { useEffect, useMemo } from 'react'
import Link from 'next/link'
import { ArrowLeft, ArrowRight } from 'lucide-react'
import { useHydrated } from '@/app/components/ui/use-hydrated'
import { useSessionStorage } from '@/app/components/ui/use-session-storage'
import { setHeaderBackTarget } from '@/app/components/header-back-target'
import { listStorageKey, locate, parseSnapshot, type ListItem, type ListKey, type ListPosition } from '@/lib/recipe-list-context'
import { recipePath } from '@/lib/routes'

interface RecipeListProps {
  slug: string
  /** A whitelisted ?from key, or null when the visitor did not come from a list. */
  from: ListKey | null
  /** Server-computed category context: the fallback, and the whole bar without ?from. */
  fallback: ListPosition | null
}

// Desktop only (A9, lg): "← {lista} · N z M" on the left of the page's breadcrumbs
// row. Below lg the header carries „← {lista}” instead (C3, E01-S28), so the page
// starts with the photo. Fixed height, so the placeholder and the filled bar occupy
// the same space and nothing below jumps on hydration.
export const LIST_BAR =
  'hidden min-h-[48px] items-center justify-start gap-2 border-b border-border-card ' +
  'lg:flex lg:border-b-0'

// A button-shaped link: bordered, so no underline (as in the header's "Dodaj").
const NAV = 'flex min-h-[64px] items-center gap-3 rounded-tile border px-4 py-2 leading-tight no-underline!'

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

/**
 * The header's back link names the list only when the visitor came from one
 * (`?from`); a shared link or a new tab gets the plain „← Wróć” (E01-S28).
 * „Wyniki: „dynia”” is shortened to „Wyniki”, as in C3: the header row is narrow.
 */
export function headerBackLabel(label: string): string {
  return label.startsWith('Wyniki:') ? 'Wyniki' : label
}

/**
 * The list behind the header's back link: like the bar's, but without the bar's
 * two-recipe minimum — a search with one result still leads back „← Wyniki”.
 */
function useBackList({ slug, from, fallback }: RecipeListProps): ListPosition | null {
  const hydrated = useHydrated()
  const [raw] = useSessionStorage(from ? listStorageKey(from) : '')
  const fromList = useMemo(() => (from ? locate(parseSnapshot(raw), slug) : null), [from, raw, slug])
  if (!from || !hydrated) return null
  return fromList ?? fallback
}

/** "← {lista} · N z M" above the recipe from lg (A9); below lg it feeds the header's back link (C3). */
export function RecipeListBar(props: RecipeListProps) {
  const state = useListPosition(props)
  const backList = useBackList(props)
  const label = backList ? headerBackLabel(backList.label) : null
  const href = backList?.href ?? null
  useEffect(() => {
    setHeaderBackTarget(label && href ? { label, href } : null)
    return () => setHeaderBackTarget(null)
  }, [label, href])

  if (state.kind === 'none') return null
  if (state.kind === 'pending') return <div aria-hidden="true" className={LIST_BAR} />

  const { position } = state
  return (
    <nav aria-label="Lista przepisów" className={`${LIST_BAR} text-ink`}>
      {/* min-w-0 + wrap-anywhere: a long search query in "Wyniki: „…”" wraps instead
          of pushing "N z M" off screen (WCAG 1.4.10, 200% zoom). */}
      <Link
        href={position.href}
        className="inline-flex min-h-[48px] min-w-0 items-center gap-1.5 text-[18px] font-bold no-underline! wrap-anywhere hover:text-action-hover"
      >
        <ArrowLeft aria-hidden="true" size={20} className="shrink-0" />
        {position.label}
      </Link>
      <span className="shrink-0 text-[16px] text-ink-soft lg:text-[18px] lg:font-bold lg:text-ink">
        <span aria-hidden="true">
          <span className="hidden lg:inline">· </span>
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
  solo,
}: {
  item: ListItem | null
  from: ListKey | null
  direction: 'prev' | 'next'
  listLabel: string
  /** The only button of the pair: from lg it is 420 px wide on its own side (handoff 13). */
  solo?: boolean
}) {
  // At a list end: nothing to stack on mobile; an empty cell from lg so the other
  // button keeps its side.
  if (!item) return <span aria-hidden="true" className="hidden lg:block" />

  const prev = direction === 'prev'
  const word = prev ? 'Poprzedni' : 'Następny'
  const Arrow = prev ? ArrowLeft : ArrowRight
  // A9: the arrows take the accent colour on desktop; C3 keeps them ink on phones.
  const arrow = <Arrow aria-hidden="true" size={24} className="shrink-0 lg:text-action" />
  return (
    <Link
      href={recipePath(item.slug, { from })}
      className={`${NAV} ${prev ? '' : 'justify-between'} ${solo ? `lg:w-[420px] ${prev ? 'lg:justify-self-start' : 'lg:justify-self-end'}` : ''} border-ink bg-white text-ink hover:bg-surface-3`}
    >
      {prev && arrow}
      <span className="flex min-w-0 flex-col">
        {/* "Poprzedni przepis" on mobile (C3, 14 px bold); from lg the list is named
            (A9: "Poprzedni w wynikach „dynia”", 16 px). */}
        <span className="text-[14px] font-bold text-ink-soft lg:text-[16px] lg:font-normal">
          <span className="lg:hidden">{word} przepis</span>
          <span className="hidden lg:inline">
            {word} na liście: {listLabel}
          </span>
        </span>
        {/* The full title, never truncated (handoff C3, item 12). */}
        <span className="text-[18px] font-bold">{item.title}</span>
      </span>
      {!prev && arrow}
    </Link>
  )
}

/**
 * Which neighbours get a button: „Poprzedni” only when the recipe was opened from a
 * list (`linkFrom`), „Następny” whenever there is one (handoff 13, §7).
 */
export function neighbours(position: ListPosition, linkFrom: ListKey | null): { prev: ListItem | null; next: ListItem | null } {
  return { prev: linkFrom ? position.prev : null, next: position.next }
}

/**
 * Poprzedni / Następny at the end of the recipe (handoff C3, item 12): stacked 64 px
 * buttons on mobile under a 2 px rule, side by side from lg.
 */
export function RecipeListNav(props: RecipeListProps) {
  const state = useListPosition(props)
  // Nothing is reserved while pending: the nav sits at the end of the page, below
  // the fold on load, and its height depends on which neighbours exist.
  if (state.kind !== 'ready') return null

  const { position, linkFrom } = state
  // „Poprzedni” only for a recipe opened from a list (a category, Ulubione, Moje
  // przepisy, search results); from the recipe of the day, a carousel or a link there is
  // just „Następny przepis” (handoff 13, §7).
  const { prev, next } = neighbours(position, linkFrom)
  if (!prev && !next) return null
  return (
    <nav
      aria-label="Poprzedni i następny przepis"
      className="mb-10 grid grid-cols-1 gap-2 border-t border-ink pt-4 lg:grid-cols-2 lg:gap-4 lg:pt-6"
    >
      <NavLink item={prev} from={linkFrom} direction="prev" listLabel={position.label} solo={!next} />
      <NavLink item={next} from={linkFrom} direction="next" listLabel={position.label} solo={!prev} />
    </nav>
  )
}
