import { redirect } from 'next/navigation'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { RecipesContent } from './recipes-content'
import { Constants, type Database } from '@/lib/supabase.types'

type Recipe = Database['public']['Tables']['recipes']['Row']
type RecipeCategory = Database['public']['Enums']['recipe_category']

const VALID_CATEGORIES = Constants.public.Enums.recipe_category

type SearchParams = Promise<{
  shared?: string
  category?: string
  add_error?: string
  duplicate?: string
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
  const { shared, category, add_error, duplicate } = await searchParams
  const supabase = await createSupabaseServerClient()

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

  let filteredQuery = supabase
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
      recipes={(recipes || []) as Recipe[]}
      showSharedToast={shared === '1'}
      showPendingDuplicateToast={duplicate === 'pending'}
      addError={add_error}
      activeCategory={activeCategory}
      categoryCounts={counts}
    />
  )
}
