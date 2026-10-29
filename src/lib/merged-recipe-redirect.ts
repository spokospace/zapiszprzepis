// Where an old recipe URL lives now. A duplicate folded into another recipe
// (E01-S03a, scripts/collapse-*.ts, the admin panel's merge) leaves its slug behind in
// recipes_merged_duplicates; a link shared before the merge should land on the
// recipe it was folded into, not on a 404. A recipe staff deleted with a redirect
// (admin panel, recipes_deleted_by_staff.redirect_to_slug) lands on its target the
// same way. Either way the answer is a recipe guests can open: both are looked up
// in public_recipes, which leaves hidden recipes out, so a redirect never points at
// one (the caller answers 404 instead).
import type { SupabaseClient } from '@supabase/supabase-js'

/** How many merges deep a chain is followed (a recipe folded into one later folded again). */
const MAX_HOPS = 3

/**
 * The current slug of the recipe a merged duplicate's `slug` was folded into, or a
 * staff-deleted recipe's redirect target, or null when the slug was never merged or
 * redirected, or its recipe is gone or hidden. Needs a client that reads
 * recipes_merged_duplicates and recipes_deleted_by_staff, which are service-only.
 */
export async function mergedRecipeSlug(supabase: SupabaseClient, slug: string): Promise<string | null> {
  return (await mergedIntoSlug(supabase, slug)) ?? (await deletedRedirectSlug(supabase, slug))
}

/** A staff delete's redirect target, if it is still a recipe guests can open (or was merged into one). */
async function deletedRedirectSlug(supabase: SupabaseClient, slug: string): Promise<string | null> {
  const { data: deleted } = await supabase
    .from('recipes_deleted_by_staff')
    .select('redirect_to_slug')
    .eq('slug', slug)
    .order('deleted_at', { ascending: false })
    .limit(1)
    .maybeSingle()
  const target: string | null = deleted?.redirect_to_slug ?? null
  if (!target) return null
  const { data: visible } = await supabase.from('public_recipes').select('slug').eq('slug', target).maybeSingle()
  // The target may itself have been folded into another recipe since.
  return visible ? visible.slug : mergedIntoSlug(supabase, target)
}

async function mergedIntoSlug(supabase: SupabaseClient, slug: string): Promise<string | null> {
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
