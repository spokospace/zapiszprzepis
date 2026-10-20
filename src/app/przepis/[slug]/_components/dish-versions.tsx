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
  dishAccusative: string | null
  /** The server-resolved order (from ?wersje=); the client island may re-sort after hydration. */
  order: VersionsSort
  /** The recipe being viewed, for the ingredient diff and the badge comparison. */
  current: CurrentRecipe
}

// A version card in the strip (carousel on a phone, a wide row from sm): roughly full
// width on a phone, up to half the content column from lg.
const VERSION_SIZES = '(min-width: 64rem) 34rem, (min-width: 40rem) 50vw, calc(75vw - 1.5rem)'

/**
 * One version as the shared RecipeCard (E01-S31 §4): the variant note is its
 * subtitle, and the time change plus the ingredient differences sit under it.
 */
function VersionCard({ version: v, current }: { version: DishVersionRow; current: CurrentRecipe }): ReactNode {
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
    >
      {meta && <p className="text-[16px] text-ink-soft">{meta}</p>}
      {/* The label words carry the meaning, so colour is never the only signal (WCAG 1.4.1). */}
      {diff.plus.length > 0 && (
        <p className="text-[16px] break-words text-ink">
          <b className="text-[#166534]">Ma dodatkowo:</b> {diff.plus.join(', ')}
        </p>
      )}
      {diff.minus.length > 0 && (
        <p className="text-[16px] break-words text-ink">
          <b className="text-[#991b1b]">Nie ma:</b> {diff.minus.join(', ')}
        </p>
      )}
    </RecipeCard>
  )
}

/**
 * "Inne przepisy na {danie}" (E01-S21, E01-S31 §4), placed before "Podobne". The
 * heading is the anchor target of the bar; it takes focus so keyboard / screen-reader
 * users land here. The cards are rendered here (server) and handed to the client sort
 * island, which only re-orders them without a request; without JS the control's links
 * reload with ?wersje=.
 */
export function DishVersions({ versions, totalCount, dishAccusative, order, current }: DishVersionsProps) {
  if (versions.length === 0) return null
  const heading = versionsHeading(totalCount, dishAccusative)
  const cards: Record<number, ReactNode> = Object.fromEntries(
    versions.map((v) => [v.id, <VersionCard key={v.id} version={v} current={current} />]),
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
      <p className="mb-4 text-[16px] text-ink-soft">Czym różnią się od przepisu, który oglądasz.</p>
      <DishVersionsSort versions={versions} initialOrder={order} label={heading} cards={cards} />
    </section>
  )
}
