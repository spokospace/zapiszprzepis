import { redirect } from 'next/navigation'
import { createSupabaseServerClient, getCurrentUser } from '@/lib/supabase/server'
import { RecipesContent } from './recipes-content'
import { MY_RECIPE_CARD_COLUMNS, type MyRecipeCard } from '@/lib/my-recipes'
import { Constants, type Database } from '@/lib/supabase.types'
import { isRecipeTag } from '@/lib/recipe-tags'
import { searchPath } from '@/lib/routes'

type RecipeCategory = Database['public']['Enums']['recipe_category']

const VALID_CATEGORIES = Constants.public.Enums.recipe_category

type SearchParams = Promise<{
  shared?: string
  category?: string
  tag?: string
  duplicate?: string
  q?: string
}>

export const metadata = {
  title: 'Moje przepisy',
  description: 'Lista moich zapisanych przepisów',
}

export default async function RecipesPage({
  searchParams,
}: {
  searchParams: SearchParams
}) {
  const { shared, category, tag, duplicate, q } = await searchParams
  const supabase = await createSupabaseServerClient()

  // One search (E01-S05): a query on "Moje przepisy" is the Mine scope of /szukaj.
  const searchQuery = (q ?? '').trim()
  if (searchQuery) redirect(searchPath(searchQuery, 'moje'))

  // The cached session lookup the layout already made (#229): no second Auth call.
  const user = await getCurrentUser()
  if (!user) {
    redirect('/login')
  }

  const activeCategory =
    category && (VALID_CATEGORIES as readonly string[]).includes(category)
      ? (category as RecipeCategory)
      : null

  const activeTag = tag && isRecipeTag(tag) ? tag : null

  let filteredQuery = supabase
    .from('recipes')
    .select(MY_RECIPE_CARD_COLUMNS)
    .order('created_at', { ascending: false })

  // "Moje przepisy" scopes to the owner explicitly — defense in depth on top of
  // owner-only RLS, so the list stays correct if recipes are ever readable more widely.
  filteredQuery = filteredQuery.eq('user_id', user.id)

  if (activeCategory) {
    filteredQuery = filteredQuery.eq('category', activeCategory)
  }

  if (activeTag) {
    filteredQuery = filteredQuery.contains('tags', [activeTag])
  }

  const [{ data: recipes, error }, { data: allRecipes }] = await Promise.all([
    filteredQuery,
    supabase.from('recipes').select('category').eq('user_id', user.id),
  ])

  if (error) {
    console.error('[recipes] Query error:', error)
  }

  // Failed extractions surface in the header notification bell (see the
  // authenticated layout + getFailedShares), not inline on this page.

  const filteredRecipes: MyRecipeCard[] = recipes ?? []

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
      activeTag={activeTag}
      categoryCounts={counts}
    />
  )
}
