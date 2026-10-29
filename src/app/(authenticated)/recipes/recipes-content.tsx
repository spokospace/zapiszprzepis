import { Suspense } from 'react'
import Link from 'next/link'
import { RecipeCard } from '@/app/components/recipe-card'
import { RecipeListSnapshot } from '@/app/components/recipe-list-snapshot'
import { CategoryFilter } from '@/app/components/category-filter'
import { HomeSearch } from '@/app/components/home/home-search'
import { ActiveTagFilter } from '@/app/components/active-tag-filter'
import { ListResults, ListTransition } from '@/app/components/list-transition'
import { Toast } from '@/app/components/toast'
import { PageContainer } from '@/app/components/page-container'
import { buttonClasses } from '@/app/components/ui/button'
import { recipesNoun } from '@/app/components/app-menu-model'
import type { Database } from '@/lib/supabase.types'
import type { OwnRecipeCard } from '@/lib/my-recipes'
import { UnavailableRecipeTile } from '@/app/components/unavailable-recipe-tile'

type RecipeCategory = Database['public']['Enums']['recipe_category']

interface RecipesContentProps {
  recipes: OwnRecipeCard[]
  /** Which of `recipes` the signed-in owner has favorited, for the tile heart (E01-S06). */
  favoriteIds: Set<number>
  showSharedToast: boolean
  showPendingDuplicateToast?: boolean
  activeCategory?: RecipeCategory | null
  activeTag?: string | null
  categoryCounts?: Partial<Record<RecipeCategory, number>>
  /** Every recipe matching the filters; `recipes` holds the pages shown so far (#230). */
  total: number
  /** This list with its filters and page, for the recipe page's way back. */
  listHref: string
  /** „Pokaż kolejne N”, or null when everything is shown. */
  more: { href: string; count: number } | null
}

export function RecipesContent({
  recipes,
  favoriteIds,
  showSharedToast,
  showPendingDuplicateToast,
  activeCategory,
  activeTag,
  categoryCounts,
  total,
  listHref,
  more,
}: RecipesContentProps) {
  return (
    <div className="min-h-screen bg-white py-8">
      {showSharedToast && (
        <Toast
          message="Przepis wysłany do przetwarzania! Pojawi się za 1-3 minuty."
          type="success"
          duration={5000}
          clearParam="shared"
        />
      )}
      {showPendingDuplicateToast && (
        <Toast
          message="Już przetwarzam ten przepis — wróć za chwilę."
          type="info"
          duration={5000}
          clearParam="duplicate"
        />
      )}

      <PageContainer>
        <ListTransition>
          <div className="mb-6">
            <h1 className="text-3xl font-bold text-gray-900">Moje przepisy</h1>
            <p className="mt-2 text-gray-600">
              {total === 0
                ? activeCategory || activeTag
                  ? 'Brak przepisów pasujących do filtrów.'
                  : 'Brak przepisów. Dodaj pierwszy przepis!'
                : `${total} ${recipesNoun(total)}`}
            </p>
          </div>

          <div className="mb-4">
            {/* One search (E01-S05): submits to /szukaj in the "Moje" scope. */}
            <HomeSearch id="my-recipes-search" scope="moje" label="Szukaj w moich przepisach" />
          </div>

          <div className="mb-8">
            <Suspense>
              <CategoryFilter activeCategory={activeCategory} counts={categoryCounts} />
            </Suspense>
            {activeTag && (
              <div className="mt-3">
                <Suspense>
                  <ActiveTagFilter tag={activeTag} />
                </Suspense>
              </div>
            )}
          </div>

          <ListResults>
            {recipes.length === 0 ? (
              <div className="text-center py-12">
                <svg
                  aria-hidden="true"
                  className="mx-auto h-12 w-12 text-gray-400"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={1.5}
                    d="M19 14l-7 7m0 0l-7-7m7 7V3"
                  />
                </svg>
                <h3 className="mt-4 text-lg font-medium text-gray-900">
                  Brak przepisów
                </h3>
                <p className="mt-2 text-gray-600">
                  {activeCategory || activeTag
                    ? 'Nie masz jeszcze przepisów pasujących do filtrów.'
                    : 'Wróć na stronę główną, aby wyszukać lub dodać przepis.'}
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
                <RecipeListSnapshot
                  listKey="moje"
                  label="Moje przepisy"
                  href={listHref}
                  items={recipes.filter((r) => !r.hidden_at).map((r) => ({ slug: r.slug, title: r.title }))}
                />
                {recipes.map((recipe, i) => (
                  // scroll-mt clears the sticky header when „Pokaż kolejne” jumps here.
                  <div key={recipe.id} id={`wynik-${i + 1}`} className="scroll-mt-28">
                    {recipe.hidden_at ? (
                      // Hidden by staff: the row stays, so the owner sees where it went (no title, no link).
                      <UnavailableRecipeTile />
                    ) : (
                    <RecipeCard
                      from="moje"
                      slug={recipe.slug}
                      title={recipe.title}
                      imageUrl={recipe.image_url}
                      category={recipe.category}
                      description={recipe.description}
                      sourceType={recipe.source_type}
                      sourceUrl={recipe.source_url}
                      sourceAuthor={recipe.source_author}
                      favorite={{ recipeId: recipe.id, favorited: favoriteIds.has(recipe.id), isAuthenticated: true }}
                    />
                    )}
                  </div>
                ))}
              </div>
            )}
            {more && (
              <Link href={more.href} className={`${buttonClasses('outline', 'lg')} mt-8 w-full`}>
                Pokaż kolejne {more.count}
              </Link>
            )}
          </ListResults>
        </ListTransition>
      </PageContainer>
    </div>
  )
}
