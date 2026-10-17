import type { createSupabaseServerClient } from '@/lib/supabase/server'
import { categoryLabel } from '@/lib/recipe-categories'
import { categoryListPath } from '@/lib/routes'
import type { ListItem, ListPosition } from '@/lib/recipe-list-context'

type Supabase = Awaited<ReturnType<typeof createSupabaseServerClient>>

interface ContextRecipe {
  id: number
  category: string
  created_at: string
}

/**
 * The recipe's place among all public recipes of its category, newest first
 * (created_at desc, id desc): the list bar's fallback when the visitor did not
 * come from a list (E01-S07). Non-critical, so any failure logs and returns null,
 * and the page renders without the bar.
 */
export async function loadCategoryContext(supabase: Supabase, recipe: ContextRecipe): Promise<ListPosition | null> {
  // Quoted: a timestamp's "+00:00" must reach PostgREST's or() filter intact.
  const at = `"${recipe.created_at}"`
  const newer = `created_at.gt.${at},and(created_at.eq.${at},id.gt.${recipe.id})`
  const older = `created_at.lt.${at},and(created_at.eq.${at},id.lt.${recipe.id})`
  const inCategory = () => supabase.from('public_recipes').select('slug, title').eq('category', recipe.category)

  try {
    const [total, before, prev, next] = await Promise.all([
      supabase
        .from('public_recipes')
        .select('id', { count: 'exact', head: true })
        .eq('category', recipe.category),
      supabase
        .from('public_recipes')
        .select('id', { count: 'exact', head: true })
        .eq('category', recipe.category)
        .or(newer),
      // Previous = the nearest newer recipe; next = the nearest older one.
      inCategory().or(newer).order('created_at', { ascending: true }).order('id', { ascending: true }).limit(1),
      inCategory().or(older).order('created_at', { ascending: false }).order('id', { ascending: false }).limit(1),
    ])
    const error = total.error ?? before.error ?? prev.error ?? next.error
    if (error || total.count == null || before.count == null) {
      if (error) console.error('[recipe] Category context error:', error)
      return null
    }
    return {
      label: categoryLabel(recipe.category),
      href: categoryListPath(recipe.category),
      index: before.count + 1,
      total: total.count,
      prev: ((prev.data ?? []) as ListItem[])[0] ?? null,
      next: ((next.data ?? []) as ListItem[])[0] ?? null,
    }
  } catch (err) {
    console.error('[recipe] Category context failed:', err)
    return null
  }
}
