// Where an old recipe URL lives now. A duplicate folded into another recipe
// (E01-S03a, scripts/collapse-*.ts) leaves its slug behind in
// recipes_merged_duplicates; a link shared before the merge should land on the
// recipe it was folded into, not on a 404.
import type { SupabaseClient } from '@supabase/supabase-js'

/** How many merges deep a chain is followed (a recipe folded into one later folded again). */
const MAX_HOPS = 3

/**
 * The current slug of the recipe a merged duplicate's `slug` was folded into,
 * or null when the slug was never merged or its recipe is gone. Needs a client
 * that reads recipes_merged_duplicates, which is service-only.
 */
export async function mergedRecipeSlug(supabase: SupabaseClient, slug: string): Promise<string | null> {
  const { data: merged } = await supabase
    .from('recipes_merged_duplicates')
    .select('canonical_id')
    .eq('slug', slug)
    .order('merged_at', { ascending: false })
    .limit(1)
    .maybeSingle()
  let id: number | null = merged?.canonical_id ?? null

  for (let hop = 0; id != null && hop < MAX_HOPS; hop++) {
    const { data: target } = await supabase.from('public_recipes').select('slug').eq('id', id).maybeSingle()
    if (target) return target.slug
    const { data: next } = await supabase
      .from('recipes_merged_duplicates')
      .select('canonical_id')
      .eq('id', id)
      .order('merged_at', { ascending: false })
      .limit(1)
      .maybeSingle()
    id = next?.canonical_id ?? null
  }
  return null
}
