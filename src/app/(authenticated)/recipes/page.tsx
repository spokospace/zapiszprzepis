import { redirect } from 'next/navigation'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { RecipesContent } from './recipes-content'
import { Constants, type Database } from '@/lib/supabase.types'

type Recipe = Database['public']['Tables']['recipes']['Row']
type RecipeCategory = Database['public']['Enums']['recipe_category']
type Ingredient = { name?: string; amount?: string; unit?: string; section?: string }

const VALID_CATEGORIES = Constants.public.Enums.recipe_category

type SearchParams = Promise<{
  shared?: string
  category?: string
  duplicate?: string
  q?: string
}>

/**
 * Returns true when the recipe's title or any ingredient name contains the
 * (already lower-cased) query fragment. Ingredient matching happens here in JS
 * because `ingredients` is jsonb and PostgREST cannot ILIKE a jsonb column
 * (no column-to-text cast in filters). The per-user row count is tiny (MVP,
 * RLS-scoped), so client-side filtering of the fetched rows is correct and
 * avoids a DB migration.
 */
function matchesQuery(recipe: Recipe, q: string): boolean {
  if (recipe.title?.toLowerCase().includes(q)) {
    return true
  }
  const ingredients = recipe.ingredients
  if (!Array.isArray(ingredients)) {
    return false
  }
  return ingredients.some((ing) => {
    const name = (ing as Ingredient | null)?.name
    return typeof name === 'string' && name.toLowerCase().includes(q)
  })
}

export const metadata = {
  title: 'Moje przepisy',
  description: 'Lista moich zapisanych przepisów',
}

export default async function RecipesPage({
  searchParams,
}: {
  searchParams: SearchParams
}) {
  const { shared, category, duplicate, q } = await searchParams
  const supabase = await createSupabaseServerClient()

  const searchQuery = (q ?? '').trim()
  const normalizedQuery = searchQuery.toLowerCase()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  const activeCategory =
    category && (VALID_CATEGORIES as readonly string[]).includes(category)
      ? (category as RecipeCategory)
      : null

  // When searching we also need `ingredients` (jsonb) so we can match ingredient
  // names in JS — see matchesQuery for why this can't run in the DB query.
  // Two literal `.select(...)` branches keep Supabase's typed query parser happy
  // (it requires a string literal, not a computed string).
  let filteredQuery = normalizedQuery
    ? supabase
        .from('recipes')
        .select('id, slug, title, image_url, category, ingredients')
        .order('created_at', { ascending: false })
    : supabase
        .from('recipes')
        .select('id, slug, title, image_url, category')
        .order('created_at', { ascending: false })

  if (activeCategory) {
    filteredQuery = filteredQuery.eq('category', activeCategory)
  }

  const [{ data: recipes, error }, { data: allRecipes }] = await Promise.all([
    filteredQuery,
    supabase.from('recipes').select('category'),
  ])

  if (error) {
    console.error('[recipes] Query error:', error)
  }

  // Failed extractions surface in the header notification bell (see the
  // authenticated layout + getFailedShares), not inline on this page.

  const filteredRecipes = ((recipes || []) as Recipe[]).filter((recipe) =>
    normalizedQuery ? matchesQuery(recipe, normalizedQuery) : true,
  )

  const counts = (allRecipes || []).reduce<Partial<Record<RecipeCategory, number>>>(
    (acc, r) => {
      const cat = r.category as RecipeCategory
      acc[cat] = (acc[cat] ?? 0) + 1
      return acc
    },
    {},
  )

  return (
    <RecipesContent
      recipes={filteredRecipes}
      showSharedToast={shared === '1'}
      showPendingDuplicateToast={duplicate === 'pending'}
      activeCategory={activeCategory}
      categoryCounts={counts}
      searchQuery={searchQuery}
    />
  )
}
