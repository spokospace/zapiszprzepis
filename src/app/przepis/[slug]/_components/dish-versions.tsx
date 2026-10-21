import type { ReactNode } from 'react'
import {
  versionsHeading,
  versionBadges,
  ingredientDiff,
  type DishVersionRow,
  type VersionsSort,
} from '@/lib/dish-versions'
import { RecipeCard } from '@/app/components/recipe-card'
import { DishVersionsSort } from './dish-versions-sort'

/** The viewed recipe's fields the diff and the badges compare against. */
export interface CurrentRecipe {
  servings: number | null
  prep_time_minutes: number | null
  cook_time_minutes: number | null
  total_time_minutes: number | null
  times_estimated: boolean
  ingredients: unknown
}

interface DishVersionsProps {
  versions: DishVersionRow[]
  /** The full N for the heading (count over all siblings, even past the 24 fetched). */
  totalCount: number
  /** The dish name (nominative, as stored); the heading takes its genitive from it. */
  dish: string | null
  /** The signed-in viewer's favorites among these versions; null for a guest (the heart sends them to log in). */
  favoriteIds: ReadonlySet<number> | null
  /** The server-resolved order (from ?wersje=); the client island may re-sort after hydration. */
  order: VersionsSort
  /** The recipe being viewed, for the ingredient diff and the badge comparison. */
  current: CurrentRecipe
}

// A version card: 270 px in the phone carousel, half the column from sm, a third from lg
// (three columns, handoff 16).
const VERSION_SIZES = '(min-width: 64rem) 22rem, (min-width: 40rem) 50vw, 270px'

/**
 * One version as the shared RecipeCard (E01-S31 §4): the variant note is its
 * subtitle, and the time change plus the ingredient differences sit under it.
 */
function VersionCard({
  version: v,
  current,
  favoriteIds,
}: {
  version: DishVersionRow
  current: CurrentRecipe
  favoriteIds: ReadonlySet<number> | null
}): ReactNode {
  const badges = versionBadges(current, v)
  const diff = ingredientDiff(current.ingredients, v.ingredients)
  // "8 porcji (o 4 mniej) · 1 godz 30 min (krócej)" — the change from the viewed recipe.
  const meta = [badges.servings, badges.time].filter(Boolean).join(' · ')

  return (
    <RecipeCard
      slug={v.slug}
      title={v.title}
      imageUrl={v.image_url}
      // The RPC returns no category, so the no-photo placeholder uses the neutral icon.
      category=""
      description={v.variant_note}
      sourceType={v.source_type}
      sourceUrl={v.source_url}
      sourceAuthor={v.source_author}
      photo="carousel"
      sizes={VERSION_SIZES}
      favorite={{ recipeId: v.id, favorited: favoriteIds?.has(v.id) ?? false, isAuthenticated: favoriteIds !== null }}
    >
      {meta && <p className="text-[16px] text-ink-soft">{meta}</p>}
      {/* Handoff 16: under a thin rule, each line cut to two rows with „…”, the full list is in the
          recipe. The label words carry the meaning, so colour only reinforces it (WCAG 1.4.1):
          green for what this version adds, red for what it drops (both ≥ 4.5:1 on the card). */}
      {(diff.plus.length > 0 || diff.minus.length > 0) && (
        <div className="mt-1 flex flex-col gap-0.5 border-t border-border-card pt-2 text-[16px] leading-[1.4] text-ink">
          {diff.plus.length > 0 && (
            <p className="line-clamp-2 break-words">
              <b className="text-[#166534]">Ma dodatkowo:</b> {diff.plus.join(', ')}
            </p>
          )}
          {diff.minus.length > 0 && (
            <p className="line-clamp-2 break-words">
              <b className="text-[#991b1b]">Nie ma:</b> {diff.minus.join(', ')}
            </p>
          )}
        </div>
      )}
    </RecipeCard>
  )
}

/**
 * "Inne wersje {dania} (N)" (E01-S21, E01-S31 §4, handoff 16), placed before the tags and "Podobne". The
 * heading is the anchor target of the bar; it takes focus so keyboard / screen-reader
 * users land here. The cards are rendered here (server) and handed to the client sort
 * island, which only re-orders them without a request; without JS the control's links
 * reload with ?wersje=.
 */
export function DishVersions({ versions, totalCount, dish, favoriteIds, order, current }: DishVersionsProps) {
  if (versions.length === 0) return null
  const heading = versionsHeading(totalCount, dish)
  const cards: Record<number, ReactNode> = Object.fromEntries(
    versions.map((v) => [v.id, <VersionCard key={v.id} version={v} current={current} favoriteIds={favoriteIds} />]),
  )
  return (
    <section aria-labelledby="inne-przepisy" className="mb-12 border-t border-border-card pt-8">
      <h2
        id="inne-przepisy"
        tabIndex={-1}
        className="mb-1 scroll-mt-4 text-[24px] font-bold text-ink focus:outline-none"
      >
        {heading}
      </h2>
      <p className="mb-4 text-[17px] text-ink-soft">Czym różnią się od tego przepisu</p>
      <DishVersionsSort versions={versions} initialOrder={order} label={heading} cards={cards} />
    </section>
  )
}
