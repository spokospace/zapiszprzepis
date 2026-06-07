'use client'

import { RecipeCard } from '@/app/components/recipe-card'
import { Toast } from '@/app/components/toast'
import type { Database } from '@/lib/supabase.types'

type Recipe = Database['public']['Tables']['recipes']['Row']

interface RecipesContentProps {
  recipes: Recipe[]
  showSharedToast: boolean
}

export function RecipesContent({ recipes, showSharedToast }: RecipesContentProps) {
  return (
    <div className="min-h-screen bg-white py-8">
      {showSharedToast && (
        <Toast
          message="Przepis wysłany do przetwarzania! Pojawi się za 1-3 minuty."
          type="success"
          duration={5000}
        />
      )}

      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Moje przepisy</h1>
          <p className="mt-2 text-gray-600">
            {recipes.length === 0
              ? 'Brak przepisów. Udostępnij link z Facebooka!'
              : `${recipes.length} przepis${recipes.length === 1 ? '' : 'ów'}`}
          </p>
        </div>

        {/* Empty state */}
        {recipes.length === 0 ? (
          <div className="text-center py-12">
            <svg
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
            <h3 className="mt-4 text-lg font-medium text-gray-900">Brak przepisów</h3>
            <p className="mt-2 text-gray-600">
              Udostępnij URL przepisu z Facebooka lub bloga kulinarnego, a pojawi się on tutaj.
            </p>
          </div>
        ) : (
          /* Recipe grid */
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
