import { redirect } from 'next/navigation'
import { createSupabaseServerClient, getSignedInUser } from '@/lib/supabase/server'
import { RecipesContent } from './recipes-content'
import {
  MY_RECIPE_CARD_COLUMNS,
  MY_RECIPES_MAX_PAGE,
  MY_RECIPES_PAGE_SIZE,
  myRecipesHref,
  type MyRecipeCard,
} from '@/lib/my-recipes'
import { parsePageParam } from '@/lib/category-tags'
import { getFavoriteIds } from '@/lib/favorites'
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
  strona?: string
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
  const { shared, category, tag, duplicate, q, strona } = await searchParams
  const supabase = await createSupabaseServerClient()

  // One search (E01-S05): a query on "Moje przepisy" is the Mine scope of /szukaj.
  const searchQuery = (q ?? '').trim()
  if (searchQuery) redirect(searchPath(searchQuery, 'moje'))

  // The cached session lookup the layout already made (#229): no second Auth call.
  const user = await getSignedInUser()
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
    .select(MY_RECIPE_CARD_COLUMNS, { count: 'exact' })
    .order('created_at', { ascending: false })
    .order('id', { ascending: false })

  // "Moje przepisy" scopes to the owner explicitly — defense in depth on top of
  // owner-only RLS, so the list stays correct if recipes are ever readable more widely.
  filteredQuery = filteredQuery.eq('user_id', user.id)

  if (activeCategory) {
    filteredQuery = filteredQuery.eq('category', activeCategory)
  }

  if (activeTag) {
    filteredQuery = filteredQuery.contains('tags', [activeTag])
  }

  // „Pokaż kolejne” (#230) re-renders the list from the top, one page longer.
  const page = Math.min(parsePageParam(strona), MY_RECIPES_MAX_PAGE)
  const [{ data: recipes, count, error }, { data: allRecipes }] = await Promise.all([
    filteredQuery.range(0, page * MY_RECIPES_PAGE_SIZE - 1),
    supabase.from('recipes').select('category').eq('user_id', user.id),
  ])

  if (error) {
    console.error('[recipes] Query error:', error)
  }

  // Failed extractions surface in the header notification bell (see the
  // authenticated layout + getFailedShares), not inline on this page.

  const filteredRecipes: MyRecipeCard[] = recipes ?? []
  const total = count ?? filteredRecipes.length
  const remaining = total - filteredRecipes.length

  // The heart on each tile reflects the owner's own favorites (E01-S06 gaps, Q4:
  // „/recipes opts in via the `favorite` prop"). Ids are known only after the list
  // query above, so this is one more scoped lookup, empty-set on error.
  const favoriteIds = await getFavoriteIds(supabase, user.id, filteredRecipes.map((r) => r.id))

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
      favoriteIds={favoriteIds}
      showSharedToast={shared === '1'}
      showPendingDuplicateToast={duplicate === 'pending'}
      activeCategory={activeCategory}
      activeTag={activeTag}
      categoryCounts={counts}
      total={total}
      listHref={myRecipesHref(activeCategory, activeTag, page)}
      more={
        remaining > 0 && page < MY_RECIPES_MAX_PAGE && filteredRecipes.length > 0
          ? {
              // The anchor lands on the first new card, below the sticky header.
              href: `${myRecipesHref(activeCategory, activeTag, page + 1)}#wynik-${filteredRecipes.length + 1}`,
              count: Math.min(MY_RECIPES_PAGE_SIZE, remaining),
            }
          : null
      }
    />
  )
}
