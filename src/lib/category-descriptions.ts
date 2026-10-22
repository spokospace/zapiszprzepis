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
 * Curated, human `<title>` base per category — the fallback when a category has
 * no `meta_title` row yet (or the read fails). Tailored copy, not a generic
 * `{label} · …` pattern, so SEO titles read like a person wrote them even before
 * the owner tunes any of them in the dashboard. Stores the BASE only; the page
 * appends `· Zapisz Przepis`. Keep each ≤ 70 chars (the SERP title budget, also
 * enforced by the meta_title length check).
 */
const CATEGORY_TITLES: Record<RecipeCategory, string> = {
  obiady: 'Przepisy na obiad — pomysły na co dzień',
  zupy: 'Przepisy na zupy — od rosołu po kremy',
  desery: 'Desery — przepisy na słodkości',
  ciasta: 'Ciasta — przepisy na domowe wypieki',
  ciasteczka: 'Ciasteczka — przepisy na chrupiące wypieki',
  sniadania: 'Śniadania — przepisy na dobry początek dnia',
  pieczywo: 'Pieczywo — przepisy na chleb i bułki',
  przekaski: 'Przekąski — przepisy na małe co nieco',
  salatki: 'Sałatki — przepisy lekkie i sycące',
  napoje: 'Napoje — przepisy na koktajle i lemoniady',
  syropy: 'Syropy i napary — domowe przepisy',
  inne: 'Inne przepisy z internetu',
}

/** The curated `<title>` base used when no editable one is stored. */
export function fallbackCategoryTitle(category: RecipeCategory): string {
  // CATEGORY_TITLES is a complete Record, so every category has a title.
  return CATEGORY_TITLES[category]
}

/**
 * The editable SEO metadata for a category, read from category_descriptions
 * (owner-editable in the Supabase dashboard — see the migrations). One
 * primary-key read on a 12-row table returning both the title base and the
 * description, wrapped in React cache() so a render that builds metadata hits the
 * DB once, mirroring loadRecipe.
 *
 * Never throws and never returns empty: a missing row, a read error, or the
 * table/column not existing yet (deploy before migration) all degrade to the
 * curated fallbacks, so metadata generation can't turn into a 500.
 */
export const getCategoryMeta = cache(
  async (category: RecipeCategory): Promise<{ title: string; description: string }> => {
    try {
      const supabase = await createSupabaseServerClient()
      const { data, error } = await supabase
        .from('category_descriptions')
        .select('meta_title, meta_description')
        .eq('category', category)
        .maybeSingle()
      if (error) throw error
      return {
        title: data?.meta_title || fallbackCategoryTitle(category),
        description: data?.meta_description || fallbackCategoryDescription(category),
      }
    } catch (err) {
      console.error('[category-descriptions] read failed:', err)
      return { title: fallbackCategoryTitle(category), description: fallbackCategoryDescription(category) }
    }
  },
)

/** The SEO meta description for a category (see getCategoryMeta). */
export async function getCategoryDescription(category: RecipeCategory): Promise<string> {
  return (await getCategoryMeta(category)).description
}

/** The SEO `<title>` base for a category (see getCategoryMeta). */
export async function getCategoryTitle(category: RecipeCategory): Promise<string> {
  return (await getCategoryMeta(category)).title
}
