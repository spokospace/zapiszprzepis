import { Suspense } from 'react'
import Link from 'next/link'
import { Tag } from 'lucide-react'
import { categoryLabel } from '@/lib/recipe-categories'
import { sharedTagsCaption, similarHeading } from '@/lib/category-tags'
import { tagLabel } from '@/lib/recipe-tags'
import { categoryPath } from '@/lib/routes'
import { CAROUSEL_SIZES, RecipeCard } from '@/app/components/recipe-card'
import { CardCarousel } from '@/app/components/card-carousel'
import { getSimilarRecipes, type SimilarCard } from '@/lib/recipe-cache'

interface SimilarRecipesProps {
  /** `dish` (E01-S21): when set, same-dish recipes are excluded — they show in "Inne przepisy na …". */
  recipe: { id: number; category: string; tags: string[]; dish?: string | null }
}

/**
 * The bottom of the recipe page (E01-S16): "Ten przepis jest" (its tags, each
 * linking to the category filtered by it) and "Podobne" — up to 4 recipes from
 * the same category, most shared tags first, topped up with the newest — plus
 * "Wszystkie {kategoria} (N) →". Loads its own data so the page only
 * mounts it; non-critical, so a failed read logs and hides the lists.
 * Streamed behind Suspense so its read never holds up the recipe itself.
 */
export function SimilarRecipes(props: SimilarRecipesProps) {
  return (
    <Suspense fallback={null}>
      <SimilarRecipesSection {...props} />
    </Suspense>
  )
}

async function SimilarRecipesSection({ recipe }: SimilarRecipesProps) {
  let similar: SimilarCard[] = []
  let total: number | null = null
  try {
    const found = await getSimilarRecipes(recipe)
    similar = found.cards
    total = found.total
  } catch (err) {
    console.error('[recipe] Similar recipes failed:', err)
  }

  const label = categoryLabel(recipe.category)
  const heading = similarHeading(recipe.tags, similar, label)
  // "Wszystkie" only makes sense when the category holds more than this recipe.
  const showAll = similar.length > 0 || (total ?? 0) > 1
  if (recipe.tags.length === 0 && !showAll) return null

  return (
    <div className="mb-12 border-t border-border-card pt-8">
      {recipe.tags.length > 0 && (
        <section aria-labelledby="zobacz-wiecej" className="mb-10">
          <h2 id="zobacz-wiecej" className="mb-4 text-[24px] font-bold text-ink">
            Zobacz więcej przepisów:
          </h2>
          {/* Handoff 16: 52 px white pills with a 2 px ink frame and a tag icon, each opening
              the category filtered by that tag. */}
          <ul className="flex flex-wrap gap-2">
            {recipe.tags.map((tag) => (
              <li key={tag}>
                <Link
                  href={categoryPath(recipe.category, { tags: [tag] })}
                  // wrap-label (wrap-anywhere + hyphens), like chipClasses: the label's anonymous flex item would not
                  // shrink below its longest word otherwise (WCAG 1.4.10).
                  className="inline-flex min-h-[52px] items-center gap-2 rounded-pill border-2 border-ink bg-white px-[18px] text-[18px] font-bold wrap-label text-action-text no-underline! hover:bg-surface-accent"
                >
                  <Tag aria-hidden="true" className="h-5 w-5 shrink-0" />
                  {tagLabel(tag)}
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      {similar.length > 0 && (
        <section aria-labelledby="podobne">
          <h2 id="podobne" className="mb-4 text-[24px] font-bold text-ink">
            {heading}
          </h2>
          {/* A swipeable strip with buttons on a phone; two cards a row from sm, four from lg (E01-S17, A9). */}
          <CardCarousel
            label={heading}
            items={similar.map((r) => ({
              key: r.id,
              card: (
                <RecipeCard
                  slug={r.slug}
                  title={r.title}
                  imageUrl={r.image_url}
                  category={r.category}
                  // "też kruche i czekoladowe" (screen 6); a top-up card with no shared tag keeps its note.
                  description={sharedTagsCaption(recipe.tags, r.tags) ?? r.description}
                  sourceType={r.source_type}
                  sourceUrl={r.source_url}
                  sourceAuthor={r.source_author}
                  photo="carousel"
                  sizes={CAROUSEL_SIZES}
                  favorite={{ recipeId: r.id }}
                />
              ),
            }))}
          />
        </section>
      )}
      {showAll && (
        <Link
          href={categoryPath(recipe.category)}
          // A5 / screen 6: a full-width 56 px accent button on a phone; from lg it
          // shrinks to its content and sits left (#494) — a full-bleed pill reads as
          // oversized across the wide desktop column.
          className="mt-4 flex min-h-[56px] w-full items-center justify-center rounded-pill border-2 border-ink bg-white px-4 text-center text-[19px] font-bold text-action-text no-underline! hover:border-action-text lg:inline-flex lg:w-auto lg:px-6"
        >
          Wszystkie {label.toLocaleLowerCase('pl')}
          {total != null && ` (${total})`}
          {/* NBSP: the arrow stays on its text's last line at a large font (#478). */}
          {'\u00a0'}→
        </Link>
      )}
    </div>
  )
}
