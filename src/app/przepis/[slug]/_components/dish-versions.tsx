import { versionsHeading, type DishVersionRow, type VersionsSort } from '@/lib/dish-versions'
import { DishVersionsSort, type CurrentRecipe } from './dish-versions-sort'

interface DishVersionsProps {
  versions: DishVersionRow[]
  /** The full N for the heading (count over all siblings, even past the 24 fetched). */
  totalCount: number
  dishAccusative: string | null
  /** The server-resolved order (from ?wersje=); the client island may re-sort after hydration. */
  order: VersionsSort
  /** The recipe being viewed, for the ingredient diff and the badge comparison. */
  current: CurrentRecipe
}

/**
 * "Inne przepisy na {danie}" (E01-S21), placed before "Podobne". The heading is
 * the anchor target of the bar; it takes focus so keyboard / screen-reader users
 * land here. The sort control + cards are a client island so the order can change
 * without a request; without JS the control's links reload with ?wersje=.
 */
export function DishVersions({ versions, totalCount, dishAccusative, order, current }: DishVersionsProps) {
  if (versions.length === 0) return null
  const heading = versionsHeading(totalCount, dishAccusative)
  return (
    <section aria-labelledby="inne-przepisy" className="mb-12 border-t border-border-card pt-8">
      <h2
        id="inne-przepisy"
        tabIndex={-1}
        className="mb-1 scroll-mt-4 text-[26px] font-bold text-ink focus:outline-none"
      >
        {heading}
      </h2>
      <p className="mb-4 text-[16px] text-ink-soft">Różnice w porównaniu z przepisem, który oglądasz.</p>
      <DishVersionsSort versions={versions} initialOrder={order} current={current} label={heading} />
    </section>
  )
}
