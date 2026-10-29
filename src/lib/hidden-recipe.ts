import type { SupabaseClient } from '@supabase/supabase-js'
import type { PublicRecipe } from '@/lib/recipe-cache'

/**
 * What a signed-in visitor sees at the URL of a recipe staff have hidden (admin
 * panel, Phase 2). Guests get the plain 404: the public views no longer hold the
 * row. Signed-in visitors are told apart here, once the public read came back empty:
 *
 *  - staff (`recipes.read`) get the recipe itself, through the staff SELECT policy on
 *    `recipes`, with a visible "Ukryty" banner;
 *  - the owner and everybody who favorited it get an "unavailable" page
 *    (`recipe_hidden_for_viewer`, SQL, because RLS shows a favoriter neither the
 *    row nor its slug);
 *  - anybody else gets the 404 like a guest.
 */
export type HiddenRecipeView =
  | { kind: 'staff'; recipe: PublicRecipe; hiddenReason: string | null; staffRecipeId: number }
  | { kind: 'unavailable' }

// The public_recipes columns, read from the table: staff may see hidden rows there.
const STAFF_COLUMNS =
  'id, slug, title, description, image_url, category, tags, prep_time_minutes, cook_time_minutes, total_time_minutes, ' +
  'ingredients, steps, source_type, source_url, source_author, times_estimated, youtube_id, created_at, meta_description, ' +
  'servings, dish, dish_accusative, variant_note, updated_at, step_images, image_urls, hidden_at, hidden_reason'

type StaffRow = PublicRecipe & {
  image_urls: string[] | null
  updated_at: string | null
  hidden_at: string | null
  hidden_reason: string | null
}

/** A `recipes` row in the shape the recipe page reads from `public_recipes` (no moderation columns). */
export function staffRowToPublicRecipe(row: StaffRow): PublicRecipe {
  const { image_urls, updated_at, hidden_at, hidden_reason, ...rest } = row
  void hidden_at
  void hidden_reason
  return {
    ...rest,
    author_name: null,
    author_username: null,
    gallery_count: image_urls?.length ?? 0,
    last_modified: updated_at ?? row.created_at,
  }
}

/** Never throws: any failure reads as "not visible to this viewer" and the page answers 404. */
export async function resolveHiddenRecipe(supabase: SupabaseClient, slug: string): Promise<HiddenRecipeView | null> {
  try {
    const { data: isStaff } = await supabase.rpc('has_permission', { p_permission: 'recipes.read' })
    if (isStaff === true) {
      const { data } = await supabase
        .from('recipes')
        .select(STAFF_COLUMNS)
        .eq('slug', slug)
        .not('hidden_at', 'is', null)
        .order('created_at', { ascending: true })
        .order('id', { ascending: true })
        .limit(1)
      const row = (data as unknown as StaffRow[] | null)?.[0]
      if (row) {
        return { kind: 'staff', recipe: staffRowToPublicRecipe(row), hiddenReason: row.hidden_reason ?? null, staffRecipeId: row.id }
      }
    }
    const { data: unavailable } = await supabase.rpc('recipe_hidden_for_viewer', { p_slug: slug })
    return unavailable === true ? { kind: 'unavailable' } : null
  } catch (err) {
    console.error('[recipe] hidden-recipe lookup failed:', err)
    return null
  }
}
