import { cache } from 'react'
import { createSupabaseServerClient, getCurrentUser } from '@/lib/supabase/server'
import { getPublicRecipe, type PublicRecipe } from '@/lib/recipe-cache'

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
  return { recipe, error, isOwner: own?.id != null && recipe?.id === own.id, user }
})
