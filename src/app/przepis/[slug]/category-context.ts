import type { createSupabaseServerClient } from '@/lib/supabase/server'
import { categoryLabel } from '@/lib/recipe-categories'
import { categoryPath } from '@/lib/routes'
import type { ListItem, ListPosition } from '@/lib/recipe-list-context'

type Supabase = Awaited<ReturnType<typeof createSupabaseServerClient>>

/** One row of the recipe_category_context RPC (none when the recipe is not public). */
interface CategoryContextRow {
  category: string
  total: number
  /** 1-based, newest first. */
  idx: number
  prev: ListItem | null
  next: ListItem | null
}

/**
 * The recipe's place among all public recipes of its category, newest first
 * (created_at desc, id desc): the list bar's fallback when the visitor did not
 * come from a list (E01-S07). One read-only RPC (#464) in place of the four
 * queries this used to run on the critical path — the counts and both neighbours
 * come back in a single round trip. Non-critical, so any failure (including the
 * RPC not yet existing in the DB) logs and returns null, and the page renders
 * without the bar.
 */
export async function loadCategoryContext(supabase: Supabase, recipe: { id: number }): Promise<ListPosition | null> {
  try {
    const { data, error } = await supabase.rpc('recipe_category_context', { p_id: recipe.id })
    const row = (data as CategoryContextRow[] | null)?.[0]
    if (error || !row) {
      if (error) console.error('[recipe] Category context error:', error)
      return null
    }
    return {
      label: categoryLabel(row.category),
      href: categoryPath(row.category),
      index: row.idx,
      total: row.total,
      prev: row.prev,
      next: row.next,
    }
  } catch (err) {
    console.error('[recipe] Category context failed:', err)
    return null
  }
}
