'use client'

import { Suspense } from 'react'
import { RecipeCard } from '@/app/components/recipe-card'
import { CategoryFilter } from '@/app/components/category-filter'
import { RecipeSearch } from '@/app/components/recipe-search'
import { Toast } from '@/app/components/toast'
import { PageContainer } from '@/app/components/page-container'
import type { Database } from '@/lib/supabase.types'

type Recipe = Database['public']['Tables']['recipes']['Row']
type RecipeCategory = Database['public']['Enums']['recipe_category']

interface RecipesContentProps {
  recipes: Recipe[]
  showSharedToast: boolean
  showPendingDuplicateToast?: boolean
  activeCategory?: RecipeCategory | null
  categoryCounts?: Partial<Record<RecipeCategory, number>>
  searchQuery?: string
}

export function RecipesContent({
  recipes,
  showSharedToast,
  showPendingDuplicateToast,
  activeCategory,
  categoryCounts,
  searchQuery,
}: RecipesContentProps) {
  const hasSearch = Boolean(searchQuery)
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
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-gray-900">Moje przepisy</h1>
          <p className="mt-2 text-gray-600">
            {recipes.length === 0
              ? hasSearch
                ? `Brak wyników dla „${searchQuery}".`
                : activeCategory
                  ? 'Brak przepisów w tej kategorii.'
                  : 'Brak przepisów. Dodaj pierwszy przepis!'
              : `${recipes.length} przepis${recipes.length === 1 ? '' : 'ów'}`}
          </p>
        </div>

        <div className="mb-4">
          <Suspense>
            <RecipeSearch query={searchQuery} />
          </Suspense>
        </div>

        <div className="mb-8">
          <Suspense>
            <CategoryFilter activeCategory={activeCategory} counts={categoryCounts} />
          </Suspense>
        </div>

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
              {hasSearch ? 'Brak wyników' : 'Brak przepisów'}
            </h3>
            <p className="mt-2 text-gray-600">
              {hasSearch
                ? `Żaden przepis nie pasuje do „${searchQuery}". Spróbuj innej nazwy lub składnika.`
                : activeCategory
                  ? 'Nie masz jeszcze przepisów w tej kategorii.'
                  : 'Wróć na stronę główną, aby wyszukać lub dodać przepis.'}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {recipes.map((recipe) => (
              <RecipeCard
                key={recipe.id}
                slug={recipe.slug}
                title={recipe.title}
                imageUrl={recipe.image_url}
                category={recipe.category}
              />
            ))}
          </div>
        )}
      </PageContainer>
    </div>
  )
}
