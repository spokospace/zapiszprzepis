import { cache } from 'react'
import { createSupabaseServerClient, getCurrentUser } from '@/lib/supabase/server'
import { getPublicRecipe, type PublicRecipe } from '@/lib/recipe-cache'
import { resolveHiddenRecipe, type HiddenRecipeView } from '@/lib/hidden-recipe'

/**
 * One guest-safe read of the recipe for this slug, shared by the layout,
 * generateMetadata and the page through React cache() so a single render reads
 * once. The public row comes from the user-independent, cached `getPublicRecipe`
 * (#445), identical for every viewer, and a recipe that has it never touches the
 * session: the page is the same for everyone, and the browser adds what is personal.
 *
 * The slug resolves to the oldest row (see `readPublicRecipe`): the one that
 * keeps the bare slug once E01-S03b's global-unique slug migration lands. A failed
 * public read surfaces as `error` (logged by the caller before a 404), never a
 * cached empty result.
 *
 * A recipe staff hid is not in the public read. Only then is the reader checked
 * (`hidden`): staff get the recipe itself with a banner, the owner and favoriters get
 * an "unavailable" state, everybody else the 404. Guests never reach that check.
 */
export const loadRecipe = cache(async (slug: string) => {
  const { recipe, error } = await getPublicRecipe(slug).then(
    (recipe) => ({ recipe, error: null as Error | null }),
    (e: unknown) => ({ recipe: null as PublicRecipe | null, error: e instanceof Error ? e : new Error(String(e)) }),
  )
  if (recipe || error) return { recipe, error, hidden: null as HiddenRecipeView | null }

  const user = await getCurrentUser()
  const hidden = user ? await resolveHiddenRecipe(await createSupabaseServerClient(), slug) : null
  return { recipe: hidden?.kind === 'staff' ? hidden.recipe : null, error, hidden }
})
