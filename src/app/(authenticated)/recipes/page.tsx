import { redirect } from 'next/navigation'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { RecipeCard } from '@/app/components/recipe-card'
import { RecipesContent } from './recipes-content'
import type { Database } from '@/lib/supabase.types'

type Recipe = Database['public']['Tables']['recipes']['Row']

type SearchParams = Promise<{
  shared?: string
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
  const { shared } = await searchParams
  const supabase = await createSupabaseServerClient()

  // Verify user is authenticated
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  const { data: recipes, error } = await supabase
    .from('recipes')
    .select('id, slug, title, image_url, category')
    .order('created_at', { ascending: false })

  if (error) {
    console.error('[recipes] Query error:', error)
  }

  const typedRecipes = (recipes || []) as Recipe[]

  return (
    <RecipesContent
      recipes={typedRecipes}
      showSharedToast={shared === '1'}
    />
  )
}
