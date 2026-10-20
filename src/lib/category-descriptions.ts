import { cache } from 'react'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { categoryLabel, type RecipeCategory } from '@/lib/recipe-categories'

/**
 * The safety-net sentence when a category has no row yet or the read fails.
 * It is per-category (carries the label) so every page still gets a distinct,
 * readable description instead of one shared string.
 */
export function fallbackCategoryDescription(category: RecipeCategory): string {
  return `Przepisy z kategorii ${categoryLabel(category)} w aplikacji Zapisz Przepis.`
}

/**
 * The SEO meta description for a category, read from category_descriptions
 * (owner-editable in the Supabase dashboard — see the migration). A single
 * primary-key read on a 12-row table, wrapped in React cache() so a render that
 * both builds metadata and renders the page hits the DB once, mirroring
 * loadRecipe.
 *
 * Never throws and never returns empty: a missing row, a read error, or the
 * table not existing yet (deploy before migration) all degrade to
 * fallbackCategoryDescription, so metadata generation can't turn into a 500.
 */
export const getCategoryDescription = cache(async (category: RecipeCategory): Promise<string> => {
  try {
    const supabase = await createSupabaseServerClient()
    const { data, error } = await supabase
      .from('category_descriptions')
      .select('meta_description')
      .eq('category', category)
      .maybeSingle()
    if (error) throw error
    return data?.meta_description || fallbackCategoryDescription(category)
  } catch (err) {
    console.error('[category-descriptions] read failed:', err)
    return fallbackCategoryDescription(category)
  }
})
