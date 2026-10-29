import { cache } from 'react'
import { createSupabaseServerClient, getCurrentUser } from '@/lib/supabase/server'
import { getPublicRecipe, type PublicRecipe } from '@/lib/recipe-cache'
import { resolveHiddenRecipe, type HiddenRecipeView } from '@/lib/hidden-recipe'

/**
 * One guest-safe read of the recipe for this slug, shared by the layout,
 * generateMetadata and the page through React cache() so a single render reads
 * once. The public row comes from the user-independent, cached `getPublicRecipe`
 * (#445) — identical for every viewer, so it is safe to share across requests —
 * while the owner check stays per request on the cookie-bound client.
 *
 * The slug resolves to the oldest row (see `readPublicRecipe`): the one that
 * keeps the bare slug once E01-S03b's global-unique slug migration lands. `isOwner`
 * is the signed-in visitor owning that row (refresh/delete are the owner's; others
 * only read). A failed public read surfaces as `error` (logged by the caller before
 * a 404), never a cached empty result.
 *
 * A recipe staff hid is not in the public read. A signed-in visitor whose public read
 * came back empty is checked once more (`hidden`): staff get the recipe itself with a
 * banner, the owner and favoriters get an "unavailable" state, everybody else the 404.
 * Guests never reach that check.
 */
export const loadRecipe = cache(async (slug: string) => {
  const supabase = await createSupabaseServerClient()
  const user = await getCurrentUser()
  const [{ recipe, error }, { data: own }] = await Promise.all([
    getPublicRecipe(slug).then(
      (recipe) => ({ recipe, error: null as Error | null }),
      (e: unknown) => ({ recipe: null as PublicRecipe | null, error: e instanceof Error ? e : new Error(String(e)) }),
    ),
    // (user_id, slug) is unique per user, so at most one own row for this slug.
    user
      ? supabase.from('recipes').select('id').eq('slug', slug).eq('user_id', user.id).maybeSingle()
      : Promise.resolve({ data: null }),
  ])
  const hidden: HiddenRecipeView | null = !recipe && !error && user ? await resolveHiddenRecipe(supabase, slug) : null
  return {
    recipe: hidden?.kind === 'staff' ? hidden.recipe : recipe,
    error,
    isOwner: own?.id != null && (hidden?.kind === 'staff' ? hidden.recipe.id : recipe?.id) === own.id,
    user,
    hidden,
  }
})
