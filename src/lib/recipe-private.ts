import type { SupabaseClient } from '@supabase/supabase-js'
import { parseStepImages } from '@/lib/steps'

/** What a recipe page adds for a signed-in reader, on top of the page everyone gets. */
export type RecipePrivate = { isOwner: boolean; galleryImages: string[]; stepImages: string[] }

export const NO_RECIPE_PRIVATE: RecipePrivate = { isOwner: false, galleryImages: [], stepImages: [] }

/**
 * The login perks and the owner's flag, read under RLS with the reader's session. The gallery
 * view is closed to guests; step photos are only hidden from them in the interface, because
 * `public_recipes` exposes them and the bucket is public. A failed read leaves its part out.
 */
export async function getRecipePrivate(supabase: SupabaseClient, userId: string, recipeId: number): Promise<RecipePrivate> {
  const [gallery, steps, own] = await Promise.all([
    supabase.from('recipe_gallery_images').select('image_urls').eq('id', recipeId).maybeSingle(),
    supabase.from('public_recipes').select('step_images').eq('id', recipeId).maybeSingle(),
    supabase.from('recipes').select('id').eq('id', recipeId).eq('user_id', userId).maybeSingle(),
  ])
  return {
    isOwner: own.data?.id === recipeId,
    galleryImages: gallery.data?.image_urls ?? [],
    stepImages: parseStepImages(steps.data?.step_images),
  }
}
