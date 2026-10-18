import { Suspense } from 'react'
import Link from 'next/link'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { categoryLabel } from '@/lib/recipe-categories'
import { rankSimilar, sharedTagsCaption, similarHeading, SIMILAR_LIMIT } from '@/lib/category-tags'
import { tagLabel } from '@/lib/recipe-tags'
import { categoryPath } from '@/lib/routes'
import { chipClasses } from '@/app/components/ui/chip'
import { CAROUSEL_SIZES, RecipeCard } from '@/app/components/recipe-card'
import { CardCarousel } from '@/app/components/card-carousel'
import { dishExclusionFilter } from '@/lib/dish-versions'
import type { RecipeSource } from '@/lib/recipe-source'

interface SimilarRecipesProps {
  /** `dish` (E01-S21): when set, same-dish recipes are excluded — they show in "Inne przepisy na …". */
  recipe: { id: number; category: string; tags: string[]; dish?: string | null }
}

interface SimilarCard {
  id: number
  slug: string
  title: string
  image_url: string | null
  category: string
  description: string | null
  source_type: RecipeSource
  source_url: string | null
  source_author: string | null
  tags: string[] | null
}

const CARD_COLUMNS = 'id, slug, title, image_url, category, description, source_type, source_url, source_author, tags'
/** Enough tag-sharing candidates to rank; a category holds a few hundred at most. */
const CANDIDATES = 50

/**
 * The bottom of the recipe page (E01-S16): "Ten przepis jest" (its tags, each
 * linking to the category filtered by it) and "Podobne" — up to 4 recipes from
 * the same category, most shared tags first, topped up with the newest — plus
 * "Wszystkie {kategoria} (N) →". Loads its own data so the page only
 * mounts it; non-critical, so a failed query logs and hides the lists.
 * Streamed behind Suspense so its three queries never hold up the recipe itself.
 */
export function SimilarRecipes(props: SimilarRecipesProps) {
  return (
    <Suspense fallback={null}>
      <SimilarRecipesSection {...props} />
    </Suspense>
  )
}

async function SimilarRecipesSection({ recipe }: SimilarRecipesProps) {
  const supabase = await createSupabaseServerClient()
  // Same category, not this recipe, newest first. When the recipe has a dish,
  // its other versions are excluded here (they show in "Inne przepisy na …"),
  // keeping null-dish rows eligible.
  const dishFilter = dishExclusionFilter(recipe.dish)
  const others = (limit: number, tags?: string[]) => {
    let q = supabase.from('public_recipes').select(CARD_COLUMNS).eq('category', recipe.category).neq('id', recipe.id)
    if (dishFilter) q = q.or(dishFilter)
    if (tags) q = q.overlaps('tags', tags)
    return q.order('created_at', { ascending: false }).order('id', { ascending: false }).limit(limit)
  }

  let similar: SimilarCard[] = []
  let total: number | null = null
  try {
    const [candidates, fill, count] = await Promise.all([
      recipe.tags.length > 0 ? others(CANDIDATES, recipe.tags) : null,
      others(SIMILAR_LIMIT),
      supabase.from('public_recipes').select('id', { count: 'exact', head: true }).eq('category', recipe.category),
    ])
    const error = candidates?.error ?? fill.error
    if (error) console.error('[recipe] Similar recipes failed:', error)
    else similar = rankSimilar(recipe.tags, (candidates?.data ?? []) as SimilarCard[], (fill.data ?? []) as SimilarCard[])
    if (count.error) console.error('[recipe] Category count failed:', count.error)
    else total = count.count
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
        <section aria-labelledby="ten-przepis-jest" className="mb-10">
          <h2 id="ten-przepis-jest" className="mb-4 text-[26px] font-bold text-ink">
            Ten przepis jest
          </h2>
          <ul className="flex flex-wrap gap-2">
            {recipe.tags.map((tag) => (
              <li key={tag}>
                <Link href={categoryPath(recipe.category, { tags: [tag] })} className={chipClasses()}>
                  {tagLabel(tag)}
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      {similar.length > 0 && (
        <section aria-labelledby="podobne">
          <h2 id="podobne" className="mb-4 text-[26px] font-bold text-ink">
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
                  sizes={CAROUSEL_SIZES}
                />
              ),
            }))}
          />
        </section>
      )}
      {showAll && (
        <Link
          href={categoryPath(recipe.category)}
          className="mt-4 inline-flex min-h-[56px] items-center text-[19px] font-bold text-action-text underline underline-offset-4 hover:text-action-hover"
        >
          Wszystkie {label.toLocaleLowerCase('pl')}
          {total != null && ` (${total})`} →
        </Link>
      )}
    </div>
  )
}
