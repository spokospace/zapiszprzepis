'use client'

import { Suspense, useEffect, useState } from 'react'
import { Link } from 'lucide-react'
import { RecipeCard } from '@/app/components/recipe-card'
import { CategoryFilter } from '@/app/components/category-filter'
import { RecipeSearch } from '@/app/components/recipe-search'
import { Toast } from '@/app/components/toast'
import { addRecipeFromUrl } from './add-recipe-action'
import type { Database } from '@/lib/supabase.types'

type Recipe = Database['public']['Tables']['recipes']['Row']
type RecipeCategory = Database['public']['Enums']['recipe_category']

const ADD_ERROR_MESSAGES: Record<string, string> = {
  empty: 'Wklej adres URL przepisu.',
  invalid_url: 'To nie wygląda jak prawidłowy URL.',
  server: 'Coś poszło nie tak. Spróbuj ponownie.',
}

interface RecipesContentProps {
  recipes: Recipe[]
  showSharedToast: boolean
  showPendingDuplicateToast?: boolean
  addError?: string | null
  activeCategory?: RecipeCategory | null
  categoryCounts?: Partial<Record<RecipeCategory, number>>
  searchQuery?: string
  showRetryingToast?: boolean
}

function AddRecipeForm({ addError }: { addError?: string | null }) {
  const [isLoading, setIsLoading] = useState(false)

  useEffect(() => {
    if (addError) {
      const url = new URL(window.location.href)
      url.searchParams.delete('add_error')
      window.history.replaceState({}, '', url.toString())
    }
  }, [addError])

  const handleSubmit = async (formData: FormData) => {
    setIsLoading(true)
    try {
      await addRecipeFromUrl(formData)
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="mb-8">
      <form action={handleSubmit} className="flex gap-2">
        <div className="relative flex-1">
          <Link aria-hidden="true" className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <input
            name="url"
            type="url"
            inputMode="url"
            aria-label="URL przepisu"
            placeholder="Wklej link do przepisu (blog, Facebook, …)"
            disabled={isLoading}
            className="w-full rounded-lg border border-gray-300 bg-white py-2.5 pl-9 pr-3 text-sm text-gray-900 placeholder:text-gray-400 focus:border-orange-500 focus:outline-none focus:ring-1 focus:ring-orange-500 disabled:bg-gray-50"
          />
        </div>
        <button
          type="submit"
          disabled={isLoading}
          className="inline-flex items-center gap-1.5 rounded-lg bg-orange-500 px-4 py-2.5 text-sm font-medium text-white hover:bg-orange-600 disabled:cursor-not-allowed disabled:bg-orange-300"
        >
          {isLoading ? (
            <>
              <svg aria-hidden="true" className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
              </svg>
              Wysyłanie…
            </>
          ) : 'Dodaj przepis'}
        </button>
      </form>
      {addError && (
        <p role="alert" className="mt-1.5 text-sm text-red-600">
          {ADD_ERROR_MESSAGES[addError] ?? ADD_ERROR_MESSAGES.server}
        </p>
      )}
    </div>
  )
}

export function RecipesContent({
  recipes,
  showSharedToast,
  showPendingDuplicateToast,
  addError,
  activeCategory,
  categoryCounts,
  searchQuery,
  showRetryingToast,
}: RecipesContentProps) {
  // `searchQuery` arrives already trimmed from the server component.
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
      {showRetryingToast && (
        <Toast
          message="Ponawiam przetwarzanie — przepis pojawi się za chwilę."
          type="success"
          duration={5000}
          clearParam="retrying"
        />
      )}

      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
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

        <AddRecipeForm addError={addError} />

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

        {/* Empty state */}
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
                  : 'Udostępnij URL przepisu z Facebooka lub bloga kulinarnego, a pojawi się on tutaj.'}
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
      </div>
    </div>
  )
}
