import { createClient } from '@supabase/supabase-js'
import { SUPABASE_URL, SUPABASE_ANON_KEY } from '@/lib/env'
import { RecipeCard } from '@/app/components/recipe-card'
import type { Database } from '@/lib/supabase.types'

type Recipe = Database['public']['Tables']['recipes']['Row']

export const metadata = {
  title: 'Moje przepisy',
  description: 'Lista moich zapisanych przepisów',
}

export default async function RecipesPage() {
  const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: {
      autoRefreshToken: true,
      persistSession: true,
    },
  })

  const { data: recipes, error } = await supabase
    .from('recipes')
    .select('id, slug, title, image_url, category')
    .order('created_at', { ascending: false })

  if (error) {
    console.error('[recipes] Query error:', error)
  }

  const typedRecipes = (recipes || []) as Recipe[]

  return (
    <div className="min-h-screen bg-white py-8">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Moje przepisy</h1>
          <p className="mt-2 text-gray-600">
            {typedRecipes.length === 0
              ? 'Brak przepisów. Udostępnij link z Facebooka!'
              : `${typedRecipes.length} przepis${typedRecipes.length === 1 ? '' : 'ów'}`}
          </p>
        </div>

        {/* Empty state */}
        {typedRecipes.length === 0 ? (
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
            {typedRecipes.map((recipe) => (
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
