'use client'

import { useMemo, useSyncExternalStore } from 'react'
import Link from 'next/link'
import { useSessionStorage } from '@/app/components/ui/use-session-storage'
import { listStorageKey, locate, parseSnapshot, type ListItem, type ListKey, type ListPosition } from '@/lib/recipe-list-context'
import { recipePath } from '@/lib/routes'

interface RecipeListBarProps {
  slug: string
  /** A whitelisted ?from key, or null when the visitor did not come from a list. */
  from: ListKey | null
  /** Server-computed category context: the fallback, and the whole bar without ?from. */
  fallback: ListPosition | null
}

// Fixed height for both rows (48 + 56 px) plus padding, so the placeholder and the
// filled bar occupy the same space and nothing below jumps on hydration.
const BAR = 'mb-6 min-h-[146px] rounded-card border border-border-card-2 p-3'

const NAV =
  'flex min-h-[56px] flex-col justify-center rounded-field border-2 px-3 py-1.5 leading-tight'

const noop = () => () => {}

/** false during SSR and hydration, true afterwards — without a setState-in-effect. */
function useHydrated(): boolean {
  return useSyncExternalStore(noop, () => true, () => false)
}

function NavLink({ item, from, direction }: { item: ListItem | null; from: ListKey | null; direction: 'prev' | 'next' }) {
  const label = direction === 'prev' ? '← Poprzedni' : 'Następny →'
  const align = direction === 'prev' ? 'text-left' : 'text-right'
  if (!item) {
    // Kept in place (not hidden) at the list ends, so the layout stays put.
    return (
      <span aria-disabled="true" className={`${NAV} ${align} border-border-card text-ink-muted`}>
        <span className="text-[17px] font-bold">{label}</span>
      </span>
    )
  }
  return (
    <Link
      href={recipePath(item.slug, { from })}
      className={`${NAV} ${align} border-field bg-white text-ink hover:bg-surface-3`}
    >
      <span className="text-[17px] font-bold">{label}</span>
      <span className="truncate text-[16px] text-ink-soft">{item.title}</span>
    </Link>
  )
}

/**
 * "← {lista}" + "N z M" + Poprzedni/Następny (E01-S07). With a valid ?from, the bar
 * reads this tab's snapshot of that list and falls back to the category context
 * when the recipe is not in it (a new tab, a stale or shared link). Without ?from
 * it is the category context straight from the server, with no client swap.
 */
export function RecipeListBar({ slug, from, fallback }: RecipeListBarProps) {
  const hydrated = useHydrated()
  const [raw] = useSessionStorage(from ? listStorageKey(from) : '')
  const fromList = useMemo(() => (from ? locate(parseSnapshot(raw), slug) : null), [from, raw, slug])

  // SSR and hydration cannot read sessionStorage: with ?from, hold the space with an
  // empty placeholder until the client knows which list (if any) this tab came from,
  // so no "N z M" is ever shown and then replaced.
  if (from && !hydrated) return <div aria-hidden="true" className={BAR} />

  const position = fromList ?? fallback
  if (!position || position.total < 2) return null
  // Prev/next keep ?from only while walking the visitor's own list.
  const linkFrom = fromList ? from : null

  return (
    <nav aria-label="Nawigacja po liście" className={BAR}>
      <div className="mb-2 flex min-h-[48px] items-center justify-between gap-3 text-[17px] font-bold text-ink">
        {position.href ? (
          <Link href={position.href} className="inline-flex min-h-[48px] items-center underline hover:text-action-hover">
            ← {position.label}
          </Link>
        ) : (
          <span>{position.label}</span>
        )}
        <span>
          <span aria-hidden="true">
            {position.index} z {position.total}
          </span>
          <span className="sr-only">
            Przepis {position.index} z {position.total} na liście {position.label}
          </span>
        </span>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <NavLink item={position.prev} from={linkFrom} direction="prev" />
        <NavLink item={position.next} from={linkFrom} direction="next" />
      </div>
    </nav>
  )
}
