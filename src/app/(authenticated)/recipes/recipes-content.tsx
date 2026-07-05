'use client'

import { Suspense, useEffect, useState } from 'react'
import { Link, Search, X } from 'lucide-react'
import { RecipeCard } from '@/app/components/recipe-card'
import { CategoryFilter } from '@/app/components/category-filter'
import { RecipeSearch } from '@/app/components/recipe-search'
import { Toast } from '@/app/components/toast'
import { addRecipeFromUrl } from './add-recipe-action'
import { searchViaExa, type ExaResult } from './search-via-exa-action'
import type { Database } from '@/lib/supabase.types'

type Recipe = Database['public']['Tables']['recipes']['Row']
type RecipeCategory = Database['public']['Enums']['recipe_category']
type SearchState = 'idle' | 'loading' | 'searching' | 'results' | 'error'

function parseHostname(url: string): string {
  try { return new URL(url).hostname } catch { return url }
}

const ADD_ERROR_MESSAGES: Record<string, string> = {
  empty: 'Wklej adres URL lub wpisz nazwę przepisu.',
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
}

function ExaResultsPanel({ results, onClose }: { results: ExaResult[]; onClose: () => void }) {
  return (
    <div className="mt-3 rounded-lg border border-gray-200 bg-white shadow-sm">
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
        <span className="text-sm font-medium text-gray-700">
          {results.length === 0
            ? 'Brak wyników'
            : `${results.length} wynik${results.length === 1 ? '' : 'ów'} z sieci`}
        </span>
        <button
          type="button"
          onClick={onClose}
          className="text-gray-400 hover:text-gray-600"
          aria-label="Zamknij wyniki"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
      {results.length === 0 ? (
        <p className="px-4 py-3 text-sm text-gray-500">Brak wyników — spróbuj innego zapytania lub wklej link.</p>
      ) : (
        <ul className="divide-y divide-gray-100">
          {results.map((result) => {
            const hostname = parseHostname(result.url)
            return (
              <li key={result.url} className="flex items-center gap-3 px-4 py-3">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900 line-clamp-1">{result.title}</p>
                  <p className="text-xs text-gray-500 truncate">{hostname}</p>
                </div>
                {result.alreadySaved ? (
                  <span className="shrink-0 text-xs text-green-600 font-medium">Już zapisany</span>
                ) : (
                  <form action={addRecipeFromUrl}>
                    <input type="hidden" name="url" value={result.url} />
                    <button
                      type="submit"
                      className="shrink-0 rounded-md bg-orange-500 px-3 py-1.5 text-xs font-medium text-white hover:bg-orange-600"
                    >
                      Zapisz
                    </button>
                  </form>
                )}
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}

function AddRecipeForm({ addError }: { addError?: string | null }) {
  const [activeTab, setActiveTab] = useState<'search' | 'add'>('search')
  const [searchState, setSearchState] = useState<SearchState>('idle')
  const [exaResults, setExaResults] = useState<ExaResult[]>([])

  useEffect(() => {
    if (addError) {
      const url = new URL(window.location.href)
      url.searchParams.delete('add_error')
      window.history.replaceState({}, '', url.toString())
    }
  }, [addError])

  const handleSubmit = async (formData: FormData) => {
    if (activeTab === 'add') {
      setSearchState('loading')
      try {
        await addRecipeFromUrl(formData)
      } finally {
        setSearchState('idle')
      }
    } else {
      const value = String(formData.get('url') ?? '').trim()
      setSearchState('searching')
      const res = await searchViaExa(value)
      if ('error' in res) {
        setSearchState('error')
      } else {
        setExaResults(res.results)
        setSearchState('results')
      }
    }
  }

  const tabClass = (tab: 'search' | 'add') =>
    `px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${
      activeTab === tab
        ? 'border-orange-500 text-orange-600'
        : 'border-transparent text-gray-500 hover:text-gray-700'
    }`

  const busy = searchState === 'loading' || searchState === 'searching'

  return (
    <div className="mb-8">
      <div className="flex border-b border-gray-200 mb-4">
        <button
          type="button"
          onClick={() => { setActiveTab('search'); setSearchState('idle') }}
          className={tabClass('search')}
        >
          Wyszukaj przepis
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('add')}
          className={tabClass('add')}
        >
          Dodaj przez link
        </button>
      </div>

      <form action={handleSubmit} className="flex gap-2">
        <div className="relative flex-1">
          {activeTab === 'search'
            ? <Search aria-hidden="true" className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            : <Link aria-hidden="true" className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          }
          <input
            name="url"
            type="text"
            aria-label={activeTab === 'search' ? 'Szukaj przepisu' : 'URL przepisu'}
            placeholder={activeTab === 'search' ? 'Wpisz nazwę przepisu, np. tiramisu' : 'Wklej link do przepisu'}
            disabled={busy}
            className="w-full rounded-lg border border-gray-300 bg-white py-2.5 pl-9 pr-3 text-sm text-gray-900 placeholder:text-gray-400 focus:border-orange-500 focus:outline-none focus:ring-1 focus:ring-orange-500 disabled:bg-gray-50"
          />
        </div>
        <button
          type="submit"
          disabled={busy}
          className="inline-flex items-center gap-1.5 rounded-lg bg-orange-500 px-4 py-2.5 text-sm font-medium text-white hover:bg-orange-600 disabled:cursor-not-allowed disabled:bg-orange-300"
        >
          {busy ? (
            <>
              <svg aria-hidden="true" className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
              </svg>
              {searchState === 'searching' ? 'Szukam…' : 'Wysyłanie…'}
            </>
          ) : activeTab === 'search' ? 'Szukaj' : 'Dodaj przepis'}
        </button>
      </form>
      {addError && activeTab === 'add' && (
        <p role="alert" className="mt-1.5 text-sm text-red-600">
          {ADD_ERROR_MESSAGES[addError] ?? ADD_ERROR_MESSAGES.server}
        </p>
      )}
      {searchState === 'error' && (
        <p role="alert" className="mt-1.5 text-sm text-red-600">
          Wyszukiwanie niedostępne — wklej link ręcznie.
        </p>
      )}
      {searchState === 'results' && (
        <ExaResultsPanel results={exaResults} onClose={() => setSearchState('idle')} />
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
